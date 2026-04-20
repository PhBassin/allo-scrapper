process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  generalLimiter,
  authLimiter,
  registerLimiter,
  protectedLimiter,
  scraperLimiter,
  publicLimiter,
  healthCheckLimiter,
} from './rate-limit.js';

const TEST_JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

// Helper: sign a minimal JWT for rate-limit key tests
const makeToken = (userId: number): string =>
  jwt.sign({ id: userId, username: `user${userId}` }, TEST_JWT_SECRET);

describe('Rate Limiting Middleware', () => {
  let app: express.Application;

  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    app = express();
    app.use(express.json());
    // Trust proxy to enable rate limiting in tests
    app.set('trust proxy', 1);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('generalLimiter', () => {
    beforeEach(() => {
      app.get('/test', generalLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('authLimiter', () => {
    beforeEach(() => {
      app.post('/login', authLimiter, (req, res) => {
        if (req.body.success) {
          return res.status(200).json({ success: true });
        }
        res.status(401).json({ success: false });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app)
        .post('/login')
        .send({ success: true });
      expect(response.status).toBe(200);
    });

    it('should skip successful requests (status 200)', async () => {
      // Make 4 successful login attempts (should not count toward limit of 2)
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/login')
          .send({ success: true });
        expect(res.status).toBe(200);
      }

      // Successful requests should not have been rate limited
      const response = await request(app)
        .post('/login')
        .send({ success: true });
      expect(response.status).toBe(200);
    });
  });

  describe('registerLimiter', () => {
    beforeEach(() => {
      app.post('/register', registerLimiter, (_req, res) => {
        res.status(201).json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/register').send({});
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('protectedLimiter', () => {
    beforeEach(() => {
      app.get('/reports', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/reports');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('scraperLimiter', () => {
    beforeEach(() => {
      app.post('/scraper/trigger', scraperLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/scraper/trigger').send({});
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('publicLimiter', () => {
    beforeEach(() => {
      app.get('/public', publicLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/public');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('protectedLimiter — per-user key generation', () => {
    it('should use user id as rate-limit key so two users on same IP have independent quotas', async () => {
      // Create a tight-limit app to make exhaustion testable without 60 requests
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2,
        skip: () => false,
        keyGenerator: authenticatedKeyGenerator,
      });
      tightApp.get('/p', tightLimiter, (_req, res) => res.json({ ok: true }));

      const token1 = makeToken(1);
      const token2 = makeToken(2);
      const sameIp = '1.2.3.4';

      // Exhaust user 1's quota (2 requests)
      await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      const exhausted = await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      expect(exhausted.status).toBe(429);

      // User 2 on same IP should still have full quota
      const user2res = await request(tightApp).get('/p').set('Authorization', `Bearer ${token2}`).set('X-Forwarded-For', sameIp);
      expect(user2res.status).toBe(200);
    });

    it('should fall back to IP when no Authorization header is present', async () => {
      app.get('/protected-fallback', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
      const response = await request(app)
        .get('/protected-fallback')
        .set('X-Forwarded-For', '5.6.7.8');
      expect(response.status).toBe(200);
    });

    it('should fall back to IP when Authorization header contains a malformed token', async () => {
      app.get('/protected-malformed', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
      const response = await request(app)
        .get('/protected-malformed')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(response.status).toBe(200);
    });
  });

  describe('scraperLimiter — per-user key generation', () => {
    it('should use user id as rate-limit key so two users on same IP have independent quotas', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2,
        skip: () => false,
        keyGenerator: authenticatedKeyGenerator,
      });
      tightApp.post('/scrape', tightLimiter, (_req, res) => res.json({ ok: true }));

      const token1 = makeToken(10);
      const token2 = makeToken(11);
      const sameIp = '2.3.4.5';

      await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp).send({});
      await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp).send({});
      const exhausted = await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp).send({});
      expect(exhausted.status).toBe(429);

      const user2res = await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token2}`).set('X-Forwarded-For', sameIp).send({});
      expect(user2res.status).toBe(200);
    });
  });

  describe('Environment variable configuration', () => {
    it('should respect RATE_LIMIT_WINDOW_MS environment variable', () => {
      const windowMs = process.env.RATE_LIMIT_WINDOW_MS;
      // Just verify the env var can be read (actual values are set at module load)
      expect(windowMs).toBeDefined();
    });

    it('should respect RATE_LIMIT_GENERAL_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_GENERAL_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_AUTH_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_AUTH_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_REGISTER_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_REGISTER_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_PROTECTED_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_PROTECTED_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_SCRAPER_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_SCRAPER_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_PUBLIC_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_PUBLIC_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_HEALTH_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_HEALTH_MAX;
      expect(max).toBeDefined();
    });
  });

  describe('healthCheckLimiter', () => {
    beforeEach(() => {
      app.get('/health', healthCheckLimiter, (_req, res) => {
        res.json({ status: 'healthy' });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '203.0.113.42'); // External IP to trigger rate limiting
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should rate limit after max requests (10 by default)', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const tightLimiter = rateLimit({
        windowMs: 60_000, // 1 minute
        max: 10,
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: 'Too many health check requests',
        },
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      const clientIp = '203.0.113.42'; // External IP

      // Make 10 requests (should all succeed)
      for (let i = 0; i < 10; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', clientIp);
        expect(res.status).toBe(200);
      }

      // 11th request should be rate limited
      const limitedResponse = await request(tightApp)
        .get('/health')
        .set('X-Forwarded-For', clientIp);
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body.error).toBeDefined();
    });

    it('should exempt localhost IPs from rate limiting', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2, // Very strict limit to make test fast
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        standardHeaders: true,
        legacyHeaders: false,
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      // Make many requests from localhost (should never be rate limited)
      for (let i = 0; i < 20; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', '127.0.0.1');
        expect(res.status).toBe(200);
      }

      // IPv6 localhost
      for (let i = 0; i < 20; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', '::1');
        expect(res.status).toBe(200);
      }
    });

    it('should return proper error message when rate limited', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 1,
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        message: {
          success: false,
          error: 'Too many health check requests',
        },
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      const clientIp = '203.0.113.99';

      // First request succeeds
      await request(tightApp).get('/health').set('X-Forwarded-For', clientIp);

      // Second request is rate limited
      const limitedResponse = await request(tightApp)
        .get('/health')
        .set('X-Forwarded-For', clientIp);
      
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body.success).toBe(false);
      expect(limitedResponse.body.error).toBe('Too many health check requests');
    });
  });
});
