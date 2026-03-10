import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import { requirePermission } from './permission.js';
import type { AuthRequest } from './auth.js';
import type { ApiResponse } from '../types/api.js';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function createMockRequest(user?: AuthRequest['user']): AuthRequest {
  return { user } as AuthRequest;
}

describe('requirePermission middleware', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    res = createMockResponse();
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should return 401 when req.user is absent', async () => {
    const req = createMockRequest(undefined);
    const middleware = requirePermission('scraper:trigger');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    } as ApiResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks required permission', async () => {
    const req = createMockRequest({
      id: 2,
      username: 'operator',
      role_name: 'operator',
      is_system_role: false,
      permissions: ['cinemas:read'],
    });
    const middleware = requirePermission('scraper:trigger');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Permission denied',
    } as ApiResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when user has all required permissions', async () => {
    const req = createMockRequest({
      id: 2,
      username: 'operator',
      role_name: 'operator',
      is_system_role: false,
      permissions: ['scraper:trigger', 'cinemas:read'],
    });
    const middleware = requirePermission('scraper:trigger');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() for admin (is_system_role=true, role_name=admin) even without permissions', async () => {
    const req = createMockRequest({
      id: 1,
      username: 'admin',
      role_name: 'admin',
      is_system_role: true,
      permissions: [],
    });
    const middleware = requirePermission('scraper:trigger');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should NOT bypass for non-system admin role (is_system_role=false, role_name=admin)', async () => {
    const req = createMockRequest({
      id: 3,
      username: 'fakeadmin',
      role_name: 'admin',
      is_system_role: false,
      permissions: [],
    });
    const middleware = requirePermission('scraper:trigger');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when ONE of multiple required permissions is missing', async () => {
    const req = createMockRequest({
      id: 2,
      username: 'operator',
      role_name: 'operator',
      is_system_role: false,
      permissions: ['cinemas:create'],
    });
    const middleware = requirePermission('cinemas:create', 'cinemas:delete');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when user has all of multiple required permissions', async () => {
    const req = createMockRequest({
      id: 2,
      username: 'operator',
      role_name: 'operator',
      is_system_role: false,
      permissions: ['cinemas:create', 'cinemas:delete', 'cinemas:update'],
    });
    const middleware = requirePermission('cinemas:create', 'cinemas:delete');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
