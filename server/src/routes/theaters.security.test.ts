import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as theaterQueries from '../db/theater-queries.js';
import * as showtimeQueries from '../db/showtime-queries.js';
import router from './theaters.js';
import { getRouteHandler } from '../test-utils/route-handler.js';
import { db } from '../db/internal/client.js';

// Mock the dependencies
vi.mock('../db/internal/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/showtime-queries.js', () => ({
  getShowtimesByTheaterAndWeek: vi.fn(),
}));

vi.mock('../db/theater-queries.js', () => ({
  getTheaters: vi.fn(),
  addTheater: vi.fn(),
  updateTheaterConfig: vi.fn(),
  deleteTheater: vi.fn(),
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: function requireAuth(_req: any, _res: any, next: any) { next(); },
}));

vi.mock('../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) =>
    function requirePermission(_req: any, _res: any, next: any) { next(); },
}));


// Helper to get middleware names for a route
function getMiddlewareNames(path: string, method: 'get' | 'post' | 'put' | 'delete'): string[] {
  const layer = router.stack.find(s => s.route?.path === path && s.route?.methods[method]);
  if (!layer) return [];
  return layer.route.stack.map((s: any) => s.name);
}

describe('Routes - Theaters - Security', () => {
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
      status: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
    mockReq = { app: mockApp };
  });

  it('should delegate error handling to next() and NOT expose sensitive details directly', async () => {
    // Simulate a database error with sensitive information
    const sensitiveError = new Error('SQL Error: Table "users" does not exist');
    (theaterQueries.getTheaters as any).mockRejectedValue(sensitiveError);

    // Get the handler for GET /
    const handler = getRouteHandler(router, '/', 'get');

    // Call the handler with mockNext
    await handler(mockReq, mockRes, mockNext);

    // Verify secure behavior:
    // 1. The error should be passed to next()
    expect(mockNext).toHaveBeenCalledWith(sensitiveError);

    // 2. The route handler should NOT send a response directly (no res.json or res.status)
    //    This ensures the global error handler (in app.ts) takes over, which handles NODE_ENV checks.
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  describe('Middleware - Permission protection on mutation routes', () => {
    it('POST / should require both requireAuth and requirePermission middleware', () => {
      const names = getMiddlewareNames('/', 'post');
      expect(names).toContain('requireAuth');
      expect(names).toContain('requirePermission');
    });

    it('PUT /:id should require both requireAuth and requirePermission middleware', () => {
      const names = getMiddlewareNames('/:id', 'put');
      expect(names).toContain('requireAuth');
      expect(names).toContain('requirePermission');
    });

    it('DELETE /:id should require both requireAuth and requirePermission middleware', () => {
      const names = getMiddlewareNames('/:id', 'delete');
      expect(names).toContain('requireAuth');
      expect(names).toContain('requirePermission');
    });

    it('GET / should NOT require authentication', () => {
      const names = getMiddlewareNames('/', 'get');
      expect(names).not.toContain('requireAuth');
      expect(names).not.toContain('requirePermission');
    });

    it('GET /:id should NOT require authentication', () => {
      const names = getMiddlewareNames('/:id', 'get');
      expect(names).not.toContain('requireAuth');
      expect(names).not.toContain('requirePermission');
    });
  });
});
