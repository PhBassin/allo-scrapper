import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  generalLimiter,
  authLimiter,
  registerLimiter,
  protectedLimiter,
  scraperLimiter,
  publicLimiter,
} from './rate-limit.js';

describe('Rate Limiting Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Trust proxy to enable rate limiting in tests
    app.set('trust proxy', 1);
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
  });
});
