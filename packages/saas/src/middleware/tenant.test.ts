/**
 * RED tests for tenant middleware.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

type MockRequest = Partial<Request> & {
  params: { slug: string };
  app: { get: (key: string) => unknown };
  org?: unknown;
  dbClient?: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
};

function makeReq(slug: string, poolOverride?: object): MockRequest {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  const pool = poolOverride ?? { connect: vi.fn().mockResolvedValue(client) };
  return {
    params: { slug },
    app: { get: (key: string) => (key === 'pool' ? pool : undefined) },
    dbClient: client,
  };
}

function makeRes(): Partial<Response> & {
  statusCode: number;
  body: unknown;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('resolveTenant', () => {
  it('calls next() and attaches req.org when org is active', async () => {
    const org = { id: 1, slug: 'acme', name: 'Acme', schema_name: 'org_acme', status: 'active' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('acme', pool) as MockRequest & { org?: typeof org };
    const res = makeRes();
    const next = vi.fn().mockResolvedValue(undefined);

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(req.org).toEqual(org);
    expect(req.dbClient).toBe(client);
    expect(client.query).toHaveBeenNthCalledWith(2, 'SET search_path TO "org_acme", public');
    expect(client.release).toHaveBeenCalled();
  });

  it('calls next() and attaches req.org when org status is trial', async () => {
    const org = { id: 2, slug: 'trial-org', schema_name: 'org_trial_org', status: 'trial' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('trial-org', pool);
    const res = makeRes();
    const next = vi.fn().mockResolvedValue(undefined);

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
  });

  it('returns 404 when org not found', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('missing', pool);
    const res = makeRes();
    const next = vi.fn();

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when org is suspended', async () => {
    const org = { id: 3, slug: 'bad', schema_name: 'org_bad', status: 'suspended' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('bad', pool);
    const res = makeRes();
    const next = vi.fn();

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('releases client exactly ONCE when org is not found (not twice)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('missing', pool);
    const res = makeRes();
    const next = vi.fn();

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('releases client exactly ONCE when org is suspended (not twice)', async () => {
    const org = { id: 3, slug: 'bad', schema_name: 'org_bad', status: 'suspended' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('bad', pool);
    const res = makeRes();
    const next = vi.fn();

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('always releases the client even when next() throws', async () => {
    const org = { id: 1, slug: 'acme', schema_name: 'org_acme', status: 'active' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('acme', pool);
    const res = makeRes();
    const next = vi.fn().mockRejectedValue(new Error('downstream error'));

    const { resolveTenant } = await import('./tenant.js');
    await expect(
      resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction)
    ).rejects.toThrow('downstream error');

    expect(client.release).toHaveBeenCalled();
  });

  it('does not release client until response finishes', async () => {
    const { EventEmitter } = await import('events');
    const org = { id: 1, slug: 'acme', schema_name: 'org_acme', status: 'active' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('acme', pool);
    const res = new EventEmitter() as any;
    res.statusCode = 200;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    const next = vi.fn().mockResolvedValue(undefined);

    const { resolveTenant } = await import('./tenant.js');
    const promise = resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    // Wait for middleware to complete
    await promise;

    // Client must NOT be released before response finish
    expect(client.release).not.toHaveBeenCalled();

    // Simulate response finishing
    res.emit('finish');

    // Now client should be released exactly once
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('releases client on response close if finish never fires', async () => {
    const { EventEmitter } = await import('events');
    const org = { id: 1, slug: 'acme', schema_name: 'org_acme', status: 'active' };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const req = makeReq('acme', pool);
    const res = new EventEmitter() as any;
    res.statusCode = 200;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    const next = vi.fn().mockResolvedValue(undefined);

    const { resolveTenant } = await import('./tenant.js');
    await resolveTenant(req as unknown as Request, res as unknown as Response, next as unknown as NextFunction);

    expect(client.release).not.toHaveBeenCalled();

    res.emit('close');

    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
