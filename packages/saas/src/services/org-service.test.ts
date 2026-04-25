/**
 * RED tests for org-service.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB, Pool } from '../db/types.js';

// We'll import after the module exists — stubbed inline for RED phase
// import { createOrg } from './org-service.js';

function makeDb(overrides: Partial<DB> = {}): DB {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    ...overrides,
  };
}

function makePool(db: DB): Pool & { connect: ReturnType<typeof vi.fn> } {
  return {
    connect: vi.fn().mockResolvedValue({
      query: db.query,
      release: vi.fn(),
    }),
  };
}

describe('createOrg', () => {
  it('throws when the slug is already taken', async () => {
    // isSlugAvailable returns false (count = 1)
    const db = makeDb({
      query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 }),
    });

    const { createOrg } = await import('./org-service.js');
    await expect(createOrg(db, { name: 'Acme', slug: 'acme' })).rejects.toThrow(
      /already taken/i
    );
  });

  it('creates schema and returns org when slug is available', async () => {
    const org = {
      id: 1,
      name: 'Acme',
      slug: 'acme',
      schema_name: 'org_acme',
      status: 'trial',
    };
    // Sequence: isSlugAvailable (count=0) → BEGIN → insertOrg (org row) → CREATE SCHEMA → SET + bootstrap SQL → COMMIT
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // isSlugAvailable
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                // BEGIN
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })             // insertOrg
      .mockResolvedValue({ rows: [], rowCount: 0 });                   // CREATE SCHEMA + bootstrap queries + COMMIT

    const db = makeDb({ query: queryMock });

    const { createOrg } = await import('./org-service.js');
    const result = await createOrg(db, { name: 'Acme', slug: 'acme' });
    expect(result.org).toEqual(org);
    expect(result.schemaCreated).toBe(true);

    // CREATE SCHEMA IF NOT EXISTS should have been called
    const calls = (queryMock as ReturnType<typeof vi.fn>).mock.calls.map(
      ([sql]: [string]) => sql
    );
    expect(calls.some((sql) => sql.includes('CREATE SCHEMA'))).toBe(true);
    expect(calls.some((sql) => sql.includes('SET search_path TO "org_acme", public'))).toBe(true);
  });

  it('issues BEGIN and ROLLBACK when schema creation fails', async () => {
    const org = {
      id: 1,
      name: 'Acme',
      slug: 'acme',
      schema_name: 'org_acme',
      status: 'trial',
    };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // isSlugAvailable
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                // BEGIN
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })             // insertOrg
      .mockRejectedValueOnce(new Error('schema creation failed'))      // CREATE SCHEMA throws
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });               // ROLLBACK

    const db = makeDb({ query: queryMock });

    const { createOrg } = await import('./org-service.js');
    await expect(createOrg(db, { name: 'Acme', slug: 'acme' })).rejects.toThrow(
      'schema creation failed'
    );

    const calls = (queryMock as ReturnType<typeof vi.fn>).mock.calls.map(
      ([sql]: [string]) => (sql as string).trim().toUpperCase()
    );
    // Transaction must have been started
    expect(calls.some((sql) => sql === 'BEGIN')).toBe(true);
    // ROLLBACK must have been issued after the failure
    expect(calls.some((sql) => sql === 'ROLLBACK')).toBe(true);
  });

  it('issues BEGIN and COMMIT on success', async () => {
    const org = {
      id: 2,
      name: 'Beta',
      slug: 'beta',
      schema_name: 'org_beta',
      status: 'trial',
    };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // isSlugAvailable
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                // BEGIN
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })             // insertOrg
      .mockResolvedValue({ rows: [], rowCount: 0 });                   // CREATE SCHEMA + bootstrap + COMMIT

    const db = makeDb({ query: queryMock });

    const { createOrg } = await import('./org-service.js');
    await createOrg(db, { name: 'Beta', slug: 'beta' });

    const calls = (queryMock as ReturnType<typeof vi.fn>).mock.calls.map(
      ([sql]: [string]) => (sql as string).trim().toUpperCase()
    );
    expect(calls.some((sql) => sql === 'BEGIN')).toBe(true);
    expect(calls.some((sql) => sql === 'COMMIT')).toBe(true);
  });

  it('uses a dedicated pool client when one is provided', async () => {
    const org = {
      id: 3,
      name: 'Gamma',
      slug: 'gamma',
      schema_name: 'org_gamma',
      status: 'trial',
    };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const db = makeDb({ query: queryMock });
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: queryMock,
        release,
      }),
    } as unknown as Pool;

    const { createOrg } = await import('./org-service.js');
    await createOrg(db, { name: 'Gamma', slug: 'gamma' }, pool);

    expect((pool.connect as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it('seeds tenant baseline cinemas from config after schema bootstrap', async () => {
    const org = {
      id: 4,
      name: 'Delta',
      slug: 'delta',
      schema_name: 'org_delta',
      status: 'trial',
    };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const db = makeDb({ query: queryMock });

    const { createOrg } = await import('./org-service.js');
    await createOrg(db, { name: 'Delta', slug: 'delta' });

    const calls = queryMock.mock.calls.map(([sql]) => String(sql));
    expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS cinemas'))).toBe(true);
    expect(calls.some((sql) => sql.includes('INSERT INTO cinemas (id, name, url)'))).toBe(true);
  });
});
