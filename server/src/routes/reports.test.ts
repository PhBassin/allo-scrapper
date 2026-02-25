import { describe, it, expect, vi, beforeEach } from 'vitest';
import router from './reports.js';
import * as queries from '../db/queries.js';

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

describe('Routes - Reports', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
        }
      };

      (queries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      // Find the handler for GET /
      const getRoute = router.stack.find(s => s.route?.path === '/' && s.route?.methods.get);
      // stack[0] is requireAuth, stack[1] is the actual handler
      const handler = getRoute?.route.stack[1].handle;

      expect(handler).toBeDefined();
      await handler(mockReq, mockRes, mockNext);

      // Verify that getScrapeReports was called with clamped limit
      expect(queries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        limit: 100 // Should be clamped to 100
      }));
    });

    it('should use default pageSize of 20 if not provided', async () => {
      mockReq = {
        query: {}
      };

      (queries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const getRoute = router.stack.find(s => s.route?.path === '/' && s.route?.methods.get);
      const handler = getRoute?.route.stack[1].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(queries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        limit: 20
      }));
    });

    it('should handle negative page numbers gracefully (default to 1)', async () => {
      mockReq = {
        query: {
          page: '-5'
        }
      };

      (queries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const getRoute = router.stack.find(s => s.route?.path === '/' && s.route?.methods.get);
      const handler = getRoute?.route.stack[1].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(queries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        offset: 0 // (1 - 1) * 20 = 0
      }));
    });
  });
});
