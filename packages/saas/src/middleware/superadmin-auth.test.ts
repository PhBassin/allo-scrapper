import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../utils/superadmin-jwt-secret-validator.js', () => ({
  validateSuperadminJWTSecret: vi.fn(),
}));

import { requireSuperadmin } from '../middleware/superadmin-auth.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

const VALID_SECRET = 'superadmin-secret-at-least-32-chars-long!!';

function signToken(payload: object, secret = VALID_SECRET, options?: jwt.SignOptions) {
  return jwt.sign(payload, secret, { expiresIn: '1h', ...options });
}

// ── requireSuperadmin ────────────────────────────────────────────────────────

describe('requireSuperadmin middleware', () => {
  beforeEach(() => {
    vi.stubEnv('SUPERADMIN_JWT_SECRET', VALID_SECRET);
  });

  it('calls next() when a valid superadmin JWT is provided', async () => {
    const token = signToken({ id: 1, username: 'root', scope: 'superadmin' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('attaches superadmin payload to req.superadmin', async () => {
    const token = signToken({ id: 7, username: 'admin', scope: 'superadmin' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect((req as any).superadmin).toMatchObject({ id: 7, username: 'admin' });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', async () => {
    const token = signToken({ id: 1, username: 'root', scope: 'superadmin' }, VALID_SECRET, {
      expiresIn: -1, // already expired
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const token = signToken({ id: 1, username: 'root', scope: 'superadmin' }, 'wrong-secret-that-is-32-chars-long!');
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token scope is not superadmin', async () => {
    // A valid org JWT (scope=org) must be rejected by this middleware
    const token = signToken({ id: 1, username: 'user', scope: 'org', org_slug: 'my-cinema' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token has no scope at all', async () => {
    const token = signToken({ id: 1, username: 'user' }); // no scope
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireSuperadmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
