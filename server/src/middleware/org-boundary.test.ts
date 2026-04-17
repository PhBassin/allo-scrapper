import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import { enforceOrgBoundary, CROSS_TENANT_MESSAGE } from './org-boundary.js';
import type { AuthRequest } from './auth.js';
import { AuthError } from '../utils/errors.js';

const { warnMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: warnMock,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function createReq(partial: Partial<AuthRequest>): AuthRequest {
  return {
    method: 'GET',
    path: '/api/org/acme/cinemas',
    query: {},
    body: {},
    ...partial,
  } as AuthRequest;
}

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('enforceOrgBoundary', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('passes through when JWT has no org_id', () => {
    const req = createReq({ user: { id: 1, username: 'admin', role_name: 'admin', is_system_role: true, permissions: [] } });
    const res = createRes();

    enforceOrgBoundary(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('returns AuthError 403 on query org_id mismatch', () => {
    const req = createReq({
      user: { id: 1, username: 'admin', role_name: 'admin', is_system_role: true, permissions: [], org_id: 1 },
      query: { org_id: '2' },
    });
    const res = createRes();

    enforceOrgBoundary(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as unknown;
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).statusCode).toBe(403);
    expect((error as AuthError).message).toBe(CROSS_TENANT_MESSAGE);
    expect(warnMock).toHaveBeenCalledOnce();
  });

  it('allows matching query org_id', () => {
    const req = createReq({
      user: { id: 1, username: 'admin', role_name: 'admin', is_system_role: true, permissions: [], org_id: 1 },
      query: { org_id: '1' },
    });
    const res = createRes();

    enforceOrgBoundary(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('sanitizes forged body org_id to authenticated org_id and logs', () => {
    const req = createReq({
      method: 'POST',
      user: { id: 1, username: 'admin', role_name: 'admin', is_system_role: true, permissions: [], org_id: 4 },
      body: { name: 'Cinema', org_id: 99 },
    });
    const res = createRes();

    enforceOrgBoundary(req, res, next);

    expect(req.body.org_id).toBe(4);
    expect(next).toHaveBeenCalledWith();
    expect(warnMock).toHaveBeenCalledOnce();
  });
});
