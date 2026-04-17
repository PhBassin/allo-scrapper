import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cinemaQueries from '../db/cinema-queries.js';
import * as showtimeQueries from '../db/showtime-queries.js';
import router from './cinemas.js';
import { db } from '../db/client.js';

// Mock the dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/showtime-queries.js', () => ({
  getShowtimesByCinemaAndWeek: vi.fn(),
}));

vi.mock('../db/cinema-queries.js', () => ({
  getCinemas: vi.fn(),
  addCinema: vi.fn(),
  updateCinemaConfig: vi.fn(),
  deleteCinema: vi.fn(),
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: function requireAuth(req: any, res: any, next: any) { next(); },
}));

vi.mock('../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) => {
    function requirePermission(req: any, res: any, next: any) { next(); }
    return requirePermission;
  },
}));

// Helper to get the actual route handler (skips middleware like rate limiters)
function getRouteHandler(path: string, method: 'get' | 'post' | 'put' | 'delete') {
  const route = router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route;
  return route?.stack[route.stack.length - 1]?.handle;
}

// Helper to get middleware names for a route
function getMiddlewareNames(path: string, method: 'get' | 'post' | 'put' | 'delete'): string[] {
  const layer = router.stack.find(s => s.route?.path === path && s.route?.methods[method]);
  if (!layer) return [];
  return layer.route.stack.map((s: any) => s.name);
}

function expectMiddlewareOrder(
  names: string[],
  orderedMiddleware: string[],
): void {
  let lastIndex = -1;
  for (const middlewareName of orderedMiddleware) {
    const index = names.indexOf(middlewareName);
    expect(index).toBeGreaterThan(lastIndex);
    lastIndex = index;
  }
}

describe('Routes - Cinemas - Security', () => {
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
    (cinemaQueries.getCinemas as any).mockRejectedValue(sensitiveError);

    // Get the handler for GET /
    const handler = getRouteHandler('/', 'get');

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
      expectMiddlewareOrder(names, ['requireAuth', 'requirePermission', 'enforceOrgBoundary']);
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
      expect(names).toContain('requireAuthForOrgRequests');
      expect(names).toContain('requireCinemaReadPermissionForOrgRequests');
      expect(names).toContain('enforceOrgBoundary');
    });

    it('GET /:id should NOT require authentication', () => {
      const names = getMiddlewareNames('/:id', 'get');
      expect(names).not.toContain('requireAuth');
      expect(names).not.toContain('requirePermission');
    });
  });
});
