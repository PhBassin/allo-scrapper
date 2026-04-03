/**
 * RED tests for org-service.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../db/types.js';

// We'll import after the module exists — stubbed inline for RED phase
// import { createOrg } from './org-service.js';

function makeDb(overrides: Partial<DB> = {}): DB {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    ...overrides,
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
    // Sequence: isSlugAvailable (count=0) → insertOrg (org row) → CREATE SCHEMA → SET + bootstrap SQL
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // isSlugAvailable
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })             // insertOrg
      .mockResolvedValue({ rows: [], rowCount: 0 });                   // CREATE SCHEMA + bootstrap queries

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
  });
});
