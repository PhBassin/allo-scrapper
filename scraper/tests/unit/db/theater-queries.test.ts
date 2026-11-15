import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../../../src/db/client.js';
import { upsertTheater, getTheaters, getTheaterConfigs } from '../../../src/db/theater-queries.js';

function createMockDb(): DB {
  return {
    query: vi.fn(),
  } as unknown as DB;
}

describe('Theater Queries', () => {
  let db: DB;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('upsertTheater', () => {
    it('passes every field to the upsert', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await upsertTheater(db, {
        id: 'C0072',
        name: 'Le Grand Rex',
        address: '1 bd Poissonnière',
        postal_code: '75002',
        city: 'Paris',
        image_url: 'https://example.com/rex.jpg',
        url: 'https://example.com/rex',
        source: 'allocine',
      });

      const [sql, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(values).toEqual([
        'C0072', 'Le Grand Rex', '1 bd Poissonnière', '75002', 'Paris',
        'https://example.com/rex.jpg', 'https://example.com/rex', 'allocine',
      ]);
    });

    it('stores missing optional fields as NULL', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await upsertTheater(db, { id: 'C0072', name: 'Le Grand Rex' });

      const [, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(values).toEqual(['C0072', 'Le Grand Rex', null, null, null, null, null, null]);
    });
  });

  describe('getTheaters', () => {
    it('maps NULL columns to undefined', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [
          { id: 'C0072', name: 'Le Grand Rex', address: null, postal_code: null, city: 'Paris', image_url: null, url: null, source: null },
        ],
        rowCount: 1,
      } as any);

      const result = await getTheaters(db);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM theaters ORDER BY name');
      expect(result).toEqual([
        { id: 'C0072', name: 'Le Grand Rex', address: undefined, postal_code: undefined, city: 'Paris', image_url: undefined, url: undefined, source: undefined },
      ]);
    });
  });

  describe('getTheaterConfigs', () => {
    it('returns theaters that have a URL', async () => {
      const rows = [{ id: 'C0072', name: 'Le Grand Rex', url: 'https://example.com/rex', source: 'allocine' }];
      vi.mocked(db.query).mockResolvedValue({ rows, rowCount: 1 } as any);

      const result = await getTheaterConfigs(db);

      expect(vi.mocked(db.query).mock.calls[0][0]).toContain('WHERE url IS NOT NULL');
      expect(result).toEqual(rows);
    });
  });
});
