/**
 * RED tests for getDbFromRequest helper.
 *
 * This test must fail before the implementation exists.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';

describe('getDbFromRequest', () => {
  it('returns req.dbClient when it is present', async () => {
    const { getDbFromRequest } = await import('./db-from-request.js');

    const dbClient = { query: vi.fn() };
    const appDb = { query: vi.fn() };

    const req = {
      dbClient,
      app: { get: vi.fn().mockReturnValue(appDb) },
    } as unknown as Request;

    const result = getDbFromRequest(req);
    expect(result).toBe(dbClient);
    expect(req.app.get).not.toHaveBeenCalled();
  });

  it('returns req.app.get("db") when req.dbClient is absent', async () => {
    const { getDbFromRequest } = await import('./db-from-request.js');

    const appDb = { query: vi.fn() };

    const req = {
      app: { get: vi.fn().mockReturnValue(appDb) },
    } as unknown as Request;

    const result = getDbFromRequest(req);
    expect(result).toBe(appDb);
    expect(req.app.get).toHaveBeenCalledWith('db');
  });
});
