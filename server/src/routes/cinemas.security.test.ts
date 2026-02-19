import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as queries from '../db/queries.js';
import router from './cinemas.js';

// Mock the dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/queries.js', () => ({
  getCinemas: vi.fn(),
  getShowtimesByCinemaAndWeek: vi.fn(),
  addCinema: vi.fn(),
  updateCinemaConfig: vi.fn(),
  deleteCinema: vi.fn(),
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

describe('Routes - Cinemas - Security', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
    mockReq = {};
  });

  it('should delegate error handling to next() and NOT expose sensitive details directly', async () => {
    // Simulate a database error with sensitive information
    const sensitiveError = new Error('SQL Error: Table "users" does not exist');
    (queries.getCinemas as any).mockRejectedValue(sensitiveError);

    // Get the handler for GET /
    const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.get)?.route.stack[0].handle;

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
});
