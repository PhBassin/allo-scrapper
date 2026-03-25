import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { DB } from '../../db/client.js';

// Mock dependencies BEFORE importing the router
vi.mock('../../db/rate-limit-queries.js');
vi.mock('../../config/rate-limits.js');
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, username: 'admin', role_name: 'admin' };
      next();
    } else {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  },
}));
vi.mock('../../middleware/rate-limit.js', () => ({
  protectedLimiter: (req: any, res: any, next: any) => next(),
}));
vi.mock('../../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) => (req: any, res: any, next: any) => next(),
}));

// Import mocked modules
import * as rateLimitQueries from '../../db/rate-limit-queries.js';
import * as rateLimitsConfig from '../../config/rate-limits.js';

// Import router AFTER mocks are set up
import rateLimitsRouter from './rate-limits.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Routes - Admin - Rate Limits', () => {
  let app: express.Application;
  const mockDb: DB = {
    query: vi.fn(),
  } as unknown as DB;

  const mockRateLimitConfig = {
    config: {
      windowMs: 900000,
      generalMax: 100,
      authMax: 5,
      registerMax: 3,
      registerWindowMs: 3600000,
      protectedMax: 60,
      scraperMax: 10,
      publicMax: 100,
      healthMax: 10,
      healthWindowMs: 60000,
    },
    source: 'database' as const,
    updatedAt: '2026-03-25T10:00:00.000Z',
    updatedBy: { id: 1, username: 'admin' },
    environment: 'production',
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.set('db', mockDb);
    app.use('/api/admin/rate-limits', rateLimitsRouter);
    app.use(errorHandler);
    
    vi.clearAllMocks();
  });

  describe('GET /api/admin/rate-limits', () => {
    it('should return current rate limit configuration', async () => {
      vi.mocked(rateLimitQueries.getRateLimits).mockResolvedValue(mockRateLimitConfig);

      const response = await request(app)
        .get('/api/admin/rate-limits')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRateLimitConfig);
      expect(rateLimitQueries.getRateLimits).toHaveBeenCalledWith(mockDb);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/rate-limits')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('PUT /api/admin/rate-limits', () => {
    it('should update rate limits and invalidate cache', async () => {
      const updates = {
        generalMax: 150,
        scraperMax: 20,
      };

      const updatedConfig = {
        ...mockRateLimitConfig,
        config: {
          ...mockRateLimitConfig.config,
          ...updates,
        },
      };

      vi.mocked(rateLimitQueries.getValidationConstraints).mockReturnValue({
        windowMs: { min: 60000, max: 3600000, unit: 'milliseconds' },
        generalMax: { min: 10, max: 1000, unit: 'requests' },
        authMax: { min: 3, max: 50, unit: 'requests' },
        registerMax: { min: 1, max: 20, unit: 'requests' },
        registerWindowMs: { min: 300000, max: 86400000, unit: 'milliseconds' },
        protectedMax: { min: 10, max: 500, unit: 'requests' },
        scraperMax: { min: 5, max: 100, unit: 'requests' },
        publicMax: { min: 20, max: 1000, unit: 'requests' },
        healthMax: { min: 5, max: 100, unit: 'requests' },
        healthWindowMs: { min: 60000, max: 60000, unit: 'milliseconds' },
      });

      vi.mocked(rateLimitQueries.updateRateLimits).mockResolvedValue(updatedConfig);

      const response = await request(app)
        .put('/api/admin/rate-limits')
        .set('Authorization', 'Bearer valid-token')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.config.generalMax).toBe(150);
      expect(response.body.data.config.scraperMax).toBe(20);
      expect(response.body.data.message).toBe('Rate limits updated. Changes will take effect within 30 seconds.');

      expect(rateLimitQueries.updateRateLimits).toHaveBeenCalledWith(
        mockDb,
        updates,
        1,
        'admin',
        'admin',
        expect.any(String),
        expect.any(String)
      );

      expect(rateLimitsConfig.invalidateRateLimitCache).toHaveBeenCalled();
    });

    it('should reject non-numeric values', async () => {
      vi.mocked(rateLimitQueries.getValidationConstraints).mockReturnValue({
        generalMax: { min: 10, max: 1000, unit: 'requests' },
      } as any);

      const response = await request(app)
        .put('/api/admin/rate-limits')
        .set('Authorization', 'Bearer valid-token')
        .send({ generalMax: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be a number');
    });

    it('should reject unknown fields', async () => {
      vi.mocked(rateLimitQueries.getValidationConstraints).mockReturnValue({
        generalMax: { min: 10, max: 1000, unit: 'requests' },
      } as any);

      const response = await request(app)
        .put('/api/admin/rate-limits')
        .set('Authorization', 'Bearer valid-token')
        .send({ unknownField: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unknown field');
    });

    it('should reject values below minimum', async () => {
      vi.mocked(rateLimitQueries.getValidationConstraints).mockReturnValue({
        generalMax: { min: 10, max: 1000, unit: 'requests' },
      } as any);

      const response = await request(app)
        .put('/api/admin/rate-limits')
        .set('Authorization', 'Bearer valid-token')
        .send({ generalMax: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 10 and 1000');
    });

    it('should reject values above maximum', async () => {
      vi.mocked(rateLimitQueries.getValidationConstraints).mockReturnValue({
        generalMax: { min: 10, max: 1000, unit: 'requests' },
      } as any);

      const response = await request(app)
        .put('/api/admin/rate-limits')
        .set('Authorization', 'Bearer valid-token')
        .send({ generalMax: 2000 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 10 and 1000');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/admin/rate-limits')
        .send({ generalMax: 150 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/rate-limits/reset', () => {
    it('should reset rate limits to defaults and invalidate cache', async () => {
      vi.mocked(rateLimitQueries.resetRateLimits).mockResolvedValue(mockRateLimitConfig);

      const response = await request(app)
        .post('/api/admin/rate-limits/reset')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Rate limits reset to default values');

      expect(rateLimitQueries.resetRateLimits).toHaveBeenCalledWith(
        mockDb,
        1,
        'admin',
        'admin',
        expect.any(String),
        expect.any(String)
      );

      expect(rateLimitsConfig.invalidateRateLimitCache).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/rate-limits/reset')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/rate-limits/audit', () => {
    it('should return audit log with pagination', async () => {
      const mockAuditLog = {
        logs: [
          {
            id: 1,
            changed_at: '2026-03-25T10:00:00Z',
            changed_by: 1,
            changed_by_username: 'admin',
            changed_by_role: 'admin',
            field_name: 'general_max',
            old_value: '100',
            new_value: '150',
            user_ip: '127.0.0.1',
            user_agent: 'Test Agent',
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      vi.mocked(rateLimitQueries.getRateLimitAuditLog).mockResolvedValue(mockAuditLog);

      const response = await request(app)
        .get('/api/admin/rate-limits/audit?limit=50&offset=0')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuditLog);

      expect(rateLimitQueries.getRateLimitAuditLog).toHaveBeenCalledWith(mockDb, {
        limit: 50,
        offset: 0,
        userId: undefined,
      });
    });

    it('should filter by userId', async () => {
      vi.mocked(rateLimitQueries.getRateLimitAuditLog).mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      await request(app)
        .get('/api/admin/rate-limits/audit?userId=1')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(rateLimitQueries.getRateLimitAuditLog).toHaveBeenCalledWith(mockDb, {
        limit: 50,
        offset: 0,
        userId: 1,
      });
    });

    it('should enforce maximum limit of 200', async () => {
      vi.mocked(rateLimitQueries.getRateLimitAuditLog).mockResolvedValue({
        logs: [],
        total: 0,
        limit: 200,
        offset: 0,
      });

      await request(app)
        .get('/api/admin/rate-limits/audit?limit=500')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(rateLimitQueries.getRateLimitAuditLog).toHaveBeenCalledWith(mockDb, {
        limit: 200, // Capped at 200
        offset: 0,
        userId: undefined,
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/rate-limits/audit')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/rate-limits/constraints', () => {
    it('should return validation constraints', async () => {
      const mockConstraints = {
        windowMs: { min: 60000, max: 3600000, unit: 'milliseconds' },
        generalMax: { min: 10, max: 1000, unit: 'requests' },
        authMax: { min: 3, max: 50, unit: 'requests' },
      };

      vi.mocked(rateLimitQueries.getValidationConstraints).mockReturnValue(mockConstraints as any);

      const response = await request(app)
        .get('/api/admin/rate-limits/constraints')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockConstraints);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/rate-limits/constraints')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
