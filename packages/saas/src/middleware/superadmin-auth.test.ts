import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requireSuperadmin } from './superadmin-auth.js';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

describe('requireSuperadmin middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const jwtSecret = 'test-secret-minimum-32-chars-required-for-validation-superadmin';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should return 401 when no authorization header', async () => {
    await requireSuperadmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header malformed', async () => {
    req.headers = { authorization: 'InvalidFormat' };

    await requireSuperadmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('should return 401 when token is invalid', async () => {
    req.headers = { authorization: 'Bearer invalid.token.here' };

    await requireSuperadmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'INVALID_TOKEN',
    });
  });

  it('should return 403 when token has no scope', async () => {
    const token = jwt.sign({ id: 'user-1', username: 'user' }, jwtSecret);
    req.headers = { authorization: `Bearer ${token}` };

    await requireSuperadmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'INSUFFICIENT_PRIVILEGES',
    });
  });

  it('should return 403 when token scope is not superadmin', async () => {
    const token = jwt.sign({ id: 'user-1', username: 'user', scope: 'org' }, jwtSecret);
    req.headers = { authorization: `Bearer ${token}` };

    await requireSuperadmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'INSUFFICIENT_PRIVILEGES',
    });
  });

  it('should attach req.superadmin and call next() when token is valid', async () => {
    const token = jwt.sign(
      { id: 'super-1', username: 'superadmin', scope: 'superadmin' },
      jwtSecret
    );
    req.headers = { authorization: `Bearer ${token}` };

    await requireSuperadmin(req as Request, res as Response, next);

    expect((req as any).superadmin).toEqual({
      id: 'super-1',
      username: 'superadmin',
    });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
