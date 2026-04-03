/**
 * RED tests for org-queries.ts
 *
 * All tests use in-memory stubs — no real DB required.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  slugToSchemaName,
  getOrgBySlug,
  getOrgById,
  insertOrg,
  isSlugAvailable,
  getPlanById,
} from './org-queries.js';
import type { DB } from './types.js';

function makeDb(rows: Record<string, unknown>[] = []): DB {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

describe('slugToSchemaName', () => {
  it('prefixes slug with org_', () => {
    expect(slugToSchemaName('acme')).toBe('org_acme');
  });

  it('replaces hyphens with underscores', () => {
    expect(slugToSchemaName('my-org-slug')).toBe('org_my_org_slug');
  });

  it('handles single-word slugs without hyphens', () => {
    expect(slugToSchemaName('cinema123')).toBe('org_cinema123');
  });
});

describe('getOrgBySlug', () => {
  it('returns the first row when found', async () => {
    const org = { id: 1, slug: 'acme', name: 'Acme' };
    const db = makeDb([org]);
    const result = await getOrgBySlug(db, 'acme');
    expect(result).toEqual(org);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('organizations'),
      ['acme']
    );
  });

  it('returns null when not found', async () => {
    const db = makeDb([]);
    const result = await getOrgBySlug(db, 'missing');
    expect(result).toBeNull();
  });
});

describe('getOrgById', () => {
  it('returns the org by id', async () => {
    const org = { id: 42, slug: 'acme' };
    const db = makeDb([org]);
    const result = await getOrgById(db, 42);
    expect(result).toEqual(org);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('organizations'),
      [42]
    );
  });

  it('returns null when not found', async () => {
    const db = makeDb([]);
    expect(await getOrgById(db, 99)).toBeNull();
  });
});

describe('insertOrg', () => {
  it('inserts and returns the created org row', async () => {
    const org = { id: 1, name: 'Acme', slug: 'acme', plan_id: 1, schema_name: 'org_acme' };
    const db = makeDb([org]);
    const result = await insertOrg(db, { name: 'Acme', slug: 'acme' });
    expect(result).toEqual(org);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organizations'),
      expect.arrayContaining(['Acme', 'acme'])
    );
  });

  it('derives schema_name from slug in the INSERT call', async () => {
    const org = { id: 2, slug: 'my-org', schema_name: 'org_my_org' };
    const db = makeDb([org]);
    await insertOrg(db, { name: 'My Org', slug: 'my-org' });
    const [, params] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toContain('org_my_org');
  });

  it('defaults plan_id to 1 when not provided', async () => {
    const db = makeDb([{ id: 1 }]);
    await insertOrg(db, { name: 'Test', slug: 'test' });
    const [, params] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toContain(1); // plan_id default
  });

  it('uses the provided plan_id when given', async () => {
    const db = makeDb([{ id: 1 }]);
    await insertOrg(db, { name: 'Pro', slug: 'pro', plan_id: 3 });
    const [, params] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toContain(3);
  });
});

describe('isSlugAvailable', () => {
  it('returns true when count is 0', async () => {
    const db = makeDb([{ count: '0' }]);
    expect(await isSlugAvailable(db, 'acme')).toBe(true);
  });

  it('returns false when count > 0', async () => {
    const db = makeDb([{ count: '1' }]);
    expect(await isSlugAvailable(db, 'acme')).toBe(false);
  });
});

describe('getPlanById', () => {
  it('returns the plan when found', async () => {
    const plan = { id: 1, name: 'free' };
    const db = makeDb([plan]);
    expect(await getPlanById(db, 1)).toEqual(plan);
  });

  it('returns null when not found', async () => {
    const db = makeDb([]);
    expect(await getPlanById(db, 99)).toBeNull();
  });
});
