import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOrgBySlug,
  getOrgById,
  insertOrg,
  isSlugAvailable,
  slugToSchemaName,
  type Organization,
} from '../db/org-queries.js';
import type { DB } from '../db/types.js';

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

function makeDb(rows: unknown[] = [], rowCount = rows.length): DB {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount }) };
}

describe('slugToSchemaName', () => {
  it('prepends org_ prefix', () => {
    expect(slugToSchemaName('mycinema')).toBe('org_mycinema');
  });
  it('replaces hyphens with underscores', () => {
    expect(slugToSchemaName('my-great-cinema')).toBe('org_my_great_cinema');
  });
});

describe('getOrgBySlug', () => {
  it('returns org when found', async () => {
    const db = makeDb([mockOrg]);
    const result = await getOrgBySlug(db, 'cinema-test');
    expect(result).toEqual(mockOrg);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('slug = $1'), ['cinema-test']);
  });

  it('returns null when not found', async () => {
    const db = makeDb([]);
    const result = await getOrgBySlug(db, 'unknown');
    expect(result).toBeNull();
  });
});

describe('getOrgById', () => {
  it('returns org when found', async () => {
    const db = makeDb([mockOrg]);
    const result = await getOrgById(db, 'uuid-123');
    expect(result).toEqual(mockOrg);
  });

  it('returns null when not found', async () => {
    const db = makeDb([]);
    const result = await getOrgById(db, 'uuid-999');
    expect(result).toBeNull();
  });
});

describe('insertOrg', () => {
  it('inserts org and returns the created record', async () => {
    const db = makeDb([mockOrg]);
    const result = await insertOrg(db, { name: 'Cinéma Test', slug: 'cinema-test' });
    expect(result).toEqual(mockOrg);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organizations'),
      expect.arrayContaining(['cinema-test', 'org_cinema_test'])
    );
  });

  it('defaults to plan_id = 1 when not provided', async () => {
    const db = makeDb([mockOrg]);
    await insertOrg(db, { name: 'Test', slug: 'test' });
    const [, params] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[2]).toBe(1);
  });

  it('uses provided plan_id', async () => {
    const db = makeDb([mockOrg]);
    await insertOrg(db, { name: 'Pro Cinema', slug: 'pro-cinema', plan_id: 3 });
    const [, params] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[2]).toBe(3);
  });

  it('sets schema_name from slug (hyphens → underscores)', async () => {
    const db = makeDb([{ ...mockOrg, schema_name: 'org_pro_cinema' }]);
    const result = await insertOrg(db, { name: 'Pro Cinema', slug: 'pro-cinema' });
    const [, params] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params[3]).toBe('org_pro_cinema');
    expect(result.schema_name).toBe('org_pro_cinema');
  });
});

describe('isSlugAvailable', () => {
  it('returns true when slug is not taken', async () => {
    const db = makeDb([{ count: '0' }]);
    const result = await isSlugAvailable(db, 'new-cinema');
    expect(result).toBe(true);
  });

  it('returns false when slug is already taken', async () => {
    const db = makeDb([{ count: '1' }]);
    const result = await isSlugAvailable(db, 'existing-cinema');
    expect(result).toBe(false);
  });
});
