import { describe, it, expect, vi, beforeEach } from 'vitest';
import router from './reports.js';
import * as reportQueries from '../db/report-queries.js';
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

vi.mock('../db/report-queries.js', () => ({
  getScrapeReports: vi.fn(),
  getScrapeReport: vi.fn()
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
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

      (reportQueries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const handler = getRouteHandler('/', 'get');
      expect(handler).toBeDefined();
      await handler(mockReq, mockRes, mockNext);

      // Verify that getScrapeReports was called with clamped limit
      expect(reportQueries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        limit: 100 // Should be clamped to 100
      }));
    });

    it('should use default pageSize of 20 if not provided', async () => {
      mockReq = {
        query: {},
        app: mockApp
      };

      (reportQueries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(reportQueries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
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

      (reportQueries.getScrapeReports as any).mockResolvedValue({ reports: [], total: 0 });

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(reportQueries.getScrapeReports).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        offset: 0 // (1 - 1) * 20 = 0
      }));
    });
  });

  describe('GET /:id/details', () => {
    it('should return report details with grouped attempts and calculated summary statistics', async () => {
      mockReq = {
        params: { id: '42' },
        app: mockApp,
      };

      const mockReport = { id: 42, status: 'success', trigger_type: 'manual' };
      const mockAttempts = [
        { id: 1, report_id: 42, theater_id: 'theater-1', status: 'success' },
        { id: 2, report_id: 42, theater_id: 'theater-1', status: 'failed' },
        { id: 3, report_id: 42, theater_id: 'theater-2', status: 'success' },
        { id: 4, report_id: 42, theater_id: 'theater-2', status: 'rate_limited' },
        { id: 5, report_id: 42, theater_id: 'theater-3', status: 'pending' },
      ];

      vi.mocked(reportQueries.getScrapeReport).mockResolvedValue(mockReport as any);
      
      const { getScrapeAttemptsByReport } = await import('../db/scrape-attempt-queries.js');
      vi.mock('../db/scrape-attempt-queries.js', () => ({
        getScrapeAttemptsByReport: vi.fn(),
      }));
      vi.mocked(getScrapeAttemptsByReport).mockResolvedValue(mockAttempts as any);

      const handler = getRouteHandler('/:id/details', 'get');
      expect(handler).toBeDefined();
      await handler(mockReq, mockRes, mockNext);

      expect(reportQueries.getScrapeReport).toHaveBeenCalledWith(expect.anything(), 42);
      expect(getScrapeAttemptsByReport).toHaveBeenCalledWith(expect.anything(), 42);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          report: mockReport,
          attempts: {
            'theater-1': [mockAttempts[0], mockAttempts[1]],
            'theater-2': [mockAttempts[2], mockAttempts[3]],
            'theater-3': [mockAttempts[4]],
          },
          summary: {
            total_attempts: 5,
            successful: 2,
            failed: 1,
            rate_limited: 1,
            not_attempted: 0,
            pending: 1,
          },
        },
      });
    });
  });
});
