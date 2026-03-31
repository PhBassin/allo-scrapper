import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTenant } from '../middleware/tenant.js';
import type { Organization } from '../db/org-queries.js';
import type { Request, Response, NextFunction } from 'express';

const mockOrg: Organization = {
  id: 'uuid-123',
  name: 'Cinéma Test',
  slug: 'cinema-test',
  plan_id: 1,
  status: 'trial',
  schema_name: 'org_cinema_test',
  trial_ends_at: new Date('2026-04-14'),
  created_at: new Date('2026-03-31'),
  updated_at: new Date('2026-03-31'),
};

function makeReq(slug: string, queryRows: unknown[] = [mockOrg]) {
  const query = vi.fn().mockResolvedValue({ rows: queryRows, rowCount: queryRows.length });
  // PoolClient mock: has query + release
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn().mockResolvedValue(client) };

  return {
    req: {
      params: { slug },
      app: { get: vi.fn().mockReturnValue(pool) },
    } as unknown as Request,
    client,
    pool,
  };
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

describe('resolveTenant', () => {
  it('attaches org to req and calls next on active org', async () => {
    const { req, client } = makeReq('cinema-test', [{ ...mockOrg, status: 'active' }]);
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).org).toMatchObject({ slug: 'cinema-test' });
    expect((req as any).dbClient).toBe(client);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET search_path TO/),
      expect.any(Array)
    );
  });

  it('attaches org to req and calls next on trial org', async () => {
    const { req } = makeReq('cinema-test', [mockOrg]); // status: 'trial'
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 404 when org is not found', async () => {
    const { req } = makeReq('unknown', []);
    const { res, status, json } = makeRes();
    const next = vi.fn() as NextFunction;

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 403 when org is suspended', async () => {
    const { req } = makeReq('suspended-org', [{ ...mockOrg, status: 'suspended' }]);
    const { res, status, json } = makeRes();
    const next = vi.fn() as NextFunction;

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 403 when org is canceled', async () => {
    const { req } = makeReq('gone-org', [{ ...mockOrg, status: 'canceled' }]);
    const { res, status, json } = makeRes();
    const next = vi.fn() as NextFunction;

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('releases pool client after calling next', async () => {
    const { req, client } = makeReq('cinema-test');
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    await resolveTenant(req, res, next);

    expect(client.release).toHaveBeenCalledOnce();
  });

  it('releases pool client even on error', async () => {
    const { req, client } = makeReq('cinema-test');
    const { res } = makeRes();
    const next = vi.fn().mockImplementation(() => { throw new Error('route error'); }) as NextFunction;

    await expect(resolveTenant(req, res, next)).rejects.toThrow('route error');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
