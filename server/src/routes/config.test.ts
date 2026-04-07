import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock rate-limit middleware BEFORE importing the router
vi.mock('../middleware/rate-limit.js', () => ({
  generalLimiter: (req: any, res: any, next: any) => next(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import router AFTER mocks
import configRouter from './config.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Routes - Config', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/config', configRouter);
    app.use(errorHandler);
    vi.clearAllMocks();
  });

  describe('GET /api/config', () => {
    it('should return saasEnabled=false when SAAS_ENABLED is not set', async () => {
      delete process.env.SAAS_ENABLED;
      delete process.env.APP_NAME;

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.saasEnabled).toBe(false);
      expect(response.body.data).toHaveProperty('appName');
    });

    it('should return saasEnabled=false when SAAS_ENABLED=false', async () => {
      process.env.SAAS_ENABLED = 'false';

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.saasEnabled).toBe(false);
    });

    it('should return saasEnabled=true when SAAS_ENABLED=true', async () => {
      process.env.SAAS_ENABLED = 'true';

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.saasEnabled).toBe(true);
    });

    it('should return appName from APP_NAME env var', async () => {
      process.env.SAAS_ENABLED = 'false';
      process.env.APP_NAME = 'My Cinema App';

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.data.appName).toBe('My Cinema App');
    });

    it('should return default appName when APP_NAME is not set', async () => {
      delete process.env.APP_NAME;

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(typeof response.body.data.appName).toBe('string');
      expect(response.body.data.appName.length).toBeGreaterThan(0);
    });

    it('should not require authentication', async () => {
      // No Authorization header — should still succeed
      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
