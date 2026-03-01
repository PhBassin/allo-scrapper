import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import { requireAdmin, type AuthRequest } from './admin.js';
import type { ApiResponse } from '../types/api.js';

// Mock database
const mockDb = {
  query: vi.fn(),
};

// Mock request helper
function createMockRequest(user?: { id: number; username: string; role?: string }): AuthRequest {
  return {
    user,
    app: {
      get: vi.fn((key: string) => key === 'db' ? mockDb : undefined),
    },
  } as any;
}

// Mock response helper
function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('requireAdmin middleware', () => {
  let req: AuthRequest;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    res = createMockResponse();
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() when user has admin role', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 1, username: 'admin', role: 'admin' }],
      rowCount: 1,
    });

    req = createMockRequest({ id: 1, username: 'admin' });
    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not authenticated', async () => {
    req = createMockRequest(undefined); // No user
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    } as ApiResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has "user" role', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 2, username: 'regular_user', role: 'user' }],
      rowCount: 1,
    });

    req = createMockRequest({ id: 2, username: 'regular_user' });
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Admin access required',
    } as ApiResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user is not found in database', async () => {
    mockDb.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
    });

    req = createMockRequest({ id: 999, username: 'nonexistent' });
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Admin access required',
    } as ApiResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    mockDb.query.mockRejectedValue(new Error('Database connection failed'));

    req = createMockRequest({ id: 1, username: 'admin' });
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should query database with correct user ID', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 42, username: 'admin', role: 'admin' }],
      rowCount: 1,
    });

    req = createMockRequest({ id: 42, username: 'admin' });
    await requireAdmin(req, res, next);

    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT id, username, role FROM users WHERE id = $1',
      [42]
    );
  });

  it('should handle missing database connection gracefully', async () => {
    req = createMockRequest({ id: 1, username: 'admin' });
    req.app.get = vi.fn().mockReturnValue(undefined); // No db

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  });

  it('should be case-sensitive for role check', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 1, username: 'user', role: 'Admin' }], // Capital A
      rowCount: 1,
    });

    req = createMockRequest({ id: 1, username: 'user' });
    await requireAdmin(req, res, next);

    // Should fail because 'Admin' !== 'admin'
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle null role gracefully', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 1, username: 'user', role: null }],
      rowCount: 1,
    });

    req = createMockRequest({ id: 1, username: 'user' });
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
