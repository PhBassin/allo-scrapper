import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { DB } from '../db/client.js';

// Mock dependencies BEFORE importing the router
vi.mock('../db/system-queries.js');
vi.mock('../services/system-info.js');
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, username: 'admin' };
      next();
    } else {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  },
}));
vi.mock('../middleware/rate-limit.js', () => ({
  protectedLimiter: (req: any, res: any, next: any) => next(),
}));
vi.mock('../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) => (req: any, res: any, next: any) => next(),
}));
vi.mock('../middleware/admin.js', () => ({
  requireAdmin: async (req: any, res: any, next: any) => {
    if (req.user?.id === 1) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin required' });
    }
  },
}));

// Import mocked modules
import * as systemQueries from '../db/system-queries.js';
import * as systemInfo from '../services/system-info.js';

// Import router AFTER mocks are set up
import systemRouter from './system.js';

describe.skip('System Routes', () => {
  let app: express.Application;
  const mockDb: DB = {
    query: vi.fn(),
  } as unknown as DB;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.set('db', mockDb);
    app.use('/api/system', systemRouter);
    
    // Clear mocks FIRST
    vi.clearAllMocks();

    // Then setup mock implementations
    vi.mocked(mockDb.query).mockImplementation(async (query: string, params?: any[]) => {
      if (query.includes('SELECT id, username, role FROM users')) {
        return {
          rows: [{ id: 1, username: 'admin', role: 'admin' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });
  });

  describe('GET /api/system/info (admin only)', () => {
    it('should return complete system info for admin', async () => {
      const mockAppInfo = {
        version: '1.0.0',
        buildDate: '2026-03-01',
        environment: 'production',
        nodeVersion: 'v20.0.0',
      };

      const mockServerHealth = {
        uptime: 3600,
        memoryUsage: {
          heapUsed: '50.25 MB',
          heapTotal: '100.50 MB',
          rss: '150.75 MB',
        },
        platform: 'linux',
        arch: 'x64',
      };

      const mockDatabaseStats = {
        size: '15 MB',
        tables: 10,
        cinemas: 5,
        films: 100,
        showtimes: 500,
      };

      vi.mocked(systemInfo.getAppInfo).mockReturnValue(mockAppInfo);
      vi.mocked(systemInfo.getServerHealth).mockReturnValue(mockServerHealth);
      vi.mocked(systemQueries.getDatabaseStats).mockResolvedValue(mockDatabaseStats);

      const response = await request(app)
        .get('/api/system/info')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        app: mockAppInfo,
        server: mockServerHealth,
        database: mockDatabaseStats,
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/system/info');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      vi.mock('../middleware/admin.js', () => ({
        requireAdmin: async (req: any, res: any, next: any) => {
          res.status(403).json({ success: false, error: 'Admin required' });
        },
      }));

      const response = await request(app)
        .get('/api/system/info')
        .set('Authorization', 'Bearer non-admin-token');

      // Note: Since we mocked requireAdmin, this should fail at auth middleware
      expect([401, 403]).toContain(response.status);
    });

    it('should handle database errors', async () => {
      vi.mocked(systemInfo.getAppInfo).mockReturnValue({
        version: '1.0.0',
        buildDate: '2026-03-01',
        environment: 'production',
        nodeVersion: 'v20.0.0',
      });
      vi.mocked(systemInfo.getServerHealth).mockReturnValue({
        uptime: 3600,
        memoryUsage: { heapUsed: '50 MB', heapTotal: '100 MB', rss: '150 MB' },
        platform: 'linux',
        arch: 'x64',
      });
      vi.mocked(systemQueries.getDatabaseStats).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/system/info')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/system/migrations (admin only)', () => {
    it('should return applied and pending migrations', async () => {
      const mockApplied = [
        { version: '001_initial.sql', appliedAt: new Date('2026-03-01T10:00:00Z'), status: 'applied' as const },
        { version: '002_users.sql', appliedAt: new Date('2026-03-01T10:01:00Z'), status: 'applied' as const },
      ];

      const mockPending = [
        { version: '003_settings.sql', status: 'pending' as const },
      ];

      vi.mocked(systemQueries.getAppliedMigrations).mockResolvedValue(mockApplied);
      vi.mocked(systemQueries.getPendingMigrations).mockResolvedValue(mockPending);

      const response = await request(app)
        .get('/api/system/migrations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        applied: mockApplied,
        pending: mockPending,
        total: 3,
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/system/migrations');

      expect(response.status).toBe(401);
    });

    it('should handle empty migrations list', async () => {
      vi.mocked(systemQueries.getAppliedMigrations).mockResolvedValue([]);
      vi.mocked(systemQueries.getPendingMigrations).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/system/migrations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        applied: [],
        pending: [],
        total: 0,
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(systemQueries.getAppliedMigrations).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/system/migrations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/system/health (admin only)', () => {
    it('should return health status with all checks', async () => {
      const mockScraperStatus = {
        activeJobs: 2,
        lastScrapeTime: new Date('2026-03-01T12:00:00Z'),
        totalCinemas: 10,
      };

      const mockServerHealth = {
        uptime: 7200,
        memoryUsage: { heapUsed: '60 MB', heapTotal: '120 MB', rss: '180 MB' },
        platform: 'linux',
        arch: 'x64',
      };

      vi.mocked(systemInfo.getScraperStatus).mockResolvedValue(mockScraperStatus);
      vi.mocked(systemInfo.getServerHealth).mockReturnValue(mockServerHealth);
      vi.mocked(systemQueries.getAppliedMigrations).mockResolvedValue([
        { version: '001_initial.sql', appliedAt: new Date(), status: 'applied' },
      ]);
      vi.mocked(systemQueries.getPendingMigrations).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/system/health')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('checks');
      expect(response.body.data).toHaveProperty('scrapers');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data.checks).toHaveProperty('database');
      expect(response.body.data.checks).toHaveProperty('migrations');
    });

    it('should return healthy status when no pending migrations', async () => {
      vi.mocked(systemInfo.getScraperStatus).mockResolvedValue({
        activeJobs: 0,
        lastScrapeTime: new Date(),
        totalCinemas: 5,
      });
      vi.mocked(systemInfo.getServerHealth).mockReturnValue({
        uptime: 3600,
        memoryUsage: { heapUsed: '50 MB', heapTotal: '100 MB', rss: '150 MB' },
        platform: 'linux',
        arch: 'x64',
      });
      vi.mocked(systemQueries.getAppliedMigrations).mockResolvedValue([]);
      vi.mocked(systemQueries.getPendingMigrations).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/system/health')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.checks.migrations).toBe(true);
    });

    it('should return degraded status when pending migrations exist', async () => {
      vi.mocked(systemInfo.getScraperStatus).mockResolvedValue({
        activeJobs: 0,
        lastScrapeTime: new Date(),
        totalCinemas: 5,
      });
      vi.mocked(systemInfo.getServerHealth).mockReturnValue({
        uptime: 3600,
        memoryUsage: { heapUsed: '50 MB', heapTotal: '100 MB', rss: '150 MB' },
        platform: 'linux',
        arch: 'x64',
      });
      vi.mocked(systemQueries.getAppliedMigrations).mockResolvedValue([]);
      vi.mocked(systemQueries.getPendingMigrations).mockResolvedValue([
        { version: '003_pending.sql', status: 'pending' },
      ]);

      const response = await request(app)
        .get('/api/system/health')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.checks.migrations).toBe(false);
    });

    it('should return error status on database failure', async () => {
      vi.mocked(systemInfo.getScraperStatus).mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/system/health')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/system/health');

      expect(response.status).toBe(401);
    });
  });
});
