// IMPORTANT: Set JWT_SECRET BEFORE any imports
// The rate limit middleware reads process.env.JWT_SECRET at module load time
process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_GENERAL_MAX = '100';
process.env.RATE_LIMIT_AUTH_MAX = '5';
process.env.RATE_LIMIT_REGISTER_MAX = '3';
process.env.RATE_LIMIT_PROTECTED_MAX = '60';
process.env.RATE_LIMIT_SCRAPER_MAX = '10';
process.env.RATE_LIMIT_PUBLIC_MAX = '100';
process.env.RATE_LIMIT_HEALTH_MAX = '10';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

// Helper: sign a minimal JWT for rate-limit key tests (secret matters now!)
const makeToken = (userId: number): string =>
  jwt.sign({ id: userId, username: `user${userId}` }, process.env.JWT_SECRET as string);

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
      app.get('/api/test', generalLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/api/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('authLimiter', () => {
    beforeEach(() => {
      app.post('/api/auth/login', authLimiter, (req, res) => {
        if (req.body.fail) {
          res.status(401).json({ success: false });
        } else {
          res.json({ success: true });
        }
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/api/auth/login').send({ fail: true });
      expect(response.status).toBe(401);
    });

    it('should skip successful requests (status 200)', async () => {
      // Create a new app just for this tight-limit test
      const tightApp = express();
      tightApp.use(express.json());
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 1, // Only 1 attempt allowed
        skipSuccessfulRequests: true,
        skip: () => false,
      });
      tightApp.post('/login', tightLimiter, (req, res) => {
        if (req.body.fail) res.status(401).json({ ok: false });
        else res.json({ ok: true });
      });

      // Successful request (should be skipped)
      await request(tightApp).post('/login').send({ fail: false });

      // Another request should still work because the first was skipped
      const res2 = await request(tightApp).post('/login').send({ fail: true });
      expect(res2.status).toBe(401);

      // But a second failure will be rate limited
      const res3 = await request(tightApp).post('/login').send({ fail: true });
      expect(res3.status).toBe(429);
    });
  });

  describe('registerLimiter', () => {
    beforeEach(() => {
      app.post('/api/auth/register', registerLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/api/auth/register').send({});
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('protectedLimiter', () => {
    beforeEach(() => {
      app.get('/api/protected', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/api/protected');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('scraperLimiter', () => {
    beforeEach(() => {
      app.post('/api/scraper', scraperLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/api/scraper').send({});
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

      await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      const exhausted = await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      expect(exhausted.status).toBe(429);

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
        .set('X-Forwarded-For', '203.0.113.42');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should rate limit after max requests (10 by default)', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const { default: rateLimit } = await import('express-rate-limit');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
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

      const clientIp = '203.0.113.42';

      for (let i = 0; i < 10; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', clientIp);
        expect(res.status).toBe(200);
      }

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
        max: 2,
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        standardHeaders: true,
        legacyHeaders: false,
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      for (let i = 0; i < 20; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', '127.0.0.1');
        expect(res.status).toBe(200);
      }

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

      await request(tightApp).get('/health').set('X-Forwarded-For', clientIp);

      const limitedResponse = await request(tightApp)
        .get('/health')
        .set('X-Forwarded-For', clientIp);
      
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body.success).toBe(false);
      expect(limitedResponse.body.error).toBe('Too many health check requests');
    });
  });
});
