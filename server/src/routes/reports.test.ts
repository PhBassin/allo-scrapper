import { describe, it, expect, vi, beforeEach } from 'vitest';
import router from './reports.js';
import * as queries from '../db/queries.js';
import { db } from '../db/client.js';

// Mock dependencies
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((req, res, next) => next())
}));
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/queries.js', () => ({
  getScrapeReports: vi.fn(),
  getScrapeReport: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  }
}));

// Helper to get the actual route handler (skips middleware like rate limiters)
function getRouteHandler(path: string, method: 'get' | 'post' | 'put' | 'delete') {
  const route = router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route;
  return route?.stack[route.stack.length - 1]?.handle;
}

describe('Routes - Reports', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;
  let mockApp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = {
      get: vi.fn((key: string) => {
        if (key === 'db') return db;
        return undefined;
      })
    };
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('GET /', () => {
    it('should clamp pageSize to 100 even if requested higher', async () => {
      mockReq = {
        query: {
          page: '1',
          pageSize: '1000' // Requesting excessive page size
        },
        app: mockApp
      };

      (queries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const handler = getRouteHandler('/', 'get');
      expect(handler).toBeDefined();
      await handler(mockReq, mockRes, mockNext);

      // Verify that getScrapeReports was called with clamped limit
      expect(queries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        limit: 100 // Should be clamped to 100
      }));
    });

    it('should use default pageSize of 20 if not provided', async () => {
      mockReq = {
        query: {},
        app: mockApp
      };

      (queries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(queries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        limit: 20
      }));
    });

    it('should handle negative page numbers gracefully (default to 1)', async () => {
      mockReq = {
        query: {
          page: '-5'
        },
        app: mockApp
      };

      (queries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(queries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        offset: 0 // (1 - 1) * 20 = 0
      }));
    });
  });
});
