import { describe, it, expect, vi } from 'vitest';
import { getTheaters, getTheaterConfigs, addTheater, updateTheaterConfig, deleteTheater, upsertTheater } from './theater-queries.js';
import { type DB } from './client.js';

describe('Theater Queries', () => {
  describe('getTheaters', () => {
    it('should return all theaters', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { id: '1', name: 'Theater 1' },
            { id: '2', name: 'Theater 2' }
          ]
        })
      } as unknown as DB;

      const result = await getTheaters(mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
    });
  });

  describe('getTheaterConfigs', () => {
    it('should return theaters that have a url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { id: 'W7504', name: 'Épée de Bois', url: 'https://www.example-theater-site.com/seance/salle_gen_csalle=W7504.html' },
            { id: 'C0072', name: 'Le Grand Action', url: 'https://www.example-theater-site.com/seance/salle_gen_csalle=C0072.html' },
          ]
        })
      } as unknown as DB;

      const result = await getTheaterConfigs(mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('W7504');
      expect(result[0].url).toBe('https://www.example-theater-site.com/seance/salle_gen_csalle=W7504.html');
    });

    it('should return empty array when no theaters with url exist', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await getTheaterConfigs(mockDb);
      expect(result).toEqual([]);
    });

    it('should query only theaters with non-null url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await getTheaterConfigs(mockDb);

      const sql: string = mockDb.query.mock.calls[0][0];
      expect(sql.toLowerCase()).toContain('url is not null');
    });
  });

  describe('addTheater', () => {
    it('should insert a new theater with id, name and url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'C0099', name: 'New Theater', url: 'https://example.com' }] })
      } as unknown as DB;

      const result = await addTheater(mockDb, { id: 'C0099', name: 'New Theater', url: 'https://example.com' });

      expect(mockDb.query).toHaveBeenCalledOnce();
      expect(result.id).toBe('C0099');
    });

    it('should throw if theater id already exists', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'))
      } as unknown as DB;

      await expect(addTheater(mockDb, { id: 'W7504', name: 'Duplicate', url: 'https://example.com' }))
        .rejects.toThrow();
    });
  });

  describe('updateTheaterConfig', () => {
    it('should update theater name and url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'W7504', name: 'Updated', url: 'https://new-url.com' }] })
      } as unknown as DB;

      const result = await updateTheaterConfig(mockDb, 'W7504', { name: 'Updated', url: 'https://new-url.com' });

      expect(mockDb.query).toHaveBeenCalledOnce();
      expect(result?.id).toBe('W7504');
    });

    it('should return undefined when theater not found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await updateTheaterConfig(mockDb, 'UNKNOWN', { name: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteTheater', () => {
    it('should delete a theater and return true when found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 })
      } as unknown as DB;

      const result = await deleteTheater(mockDb, 'W7504');
      expect(result).toBe(true);
    });

    it('should return false when theater not found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rowCount: 0 })
      } as unknown as DB;

      const result = await deleteTheater(mockDb, 'UNKNOWN');
      expect(result).toBe(false);
    });
  });

  describe('upsertTheater', () => {
    it('should preserve existing url via COALESCE when url is not provided', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await upsertTheater(mockDb, {
        id: 'W7504',
        name: 'Épée de Bois',
        address: '1 Rue de la Paix',
        postal_code: '75001',
        city: 'Paris',
        screen_count: 3,
      });

      const sql: string = mockDb.query.mock.calls[0][0];
      expect(sql.toLowerCase()).toContain('coalesce');
    });

    it('should upsert theater with all fields including url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await upsertTheater(mockDb, {
        id: 'C0099',
        name: 'New Theater',
        address: '5 Rue Test',
        postal_code: '75002',
        city: 'Paris',
        screen_count: 2,
        url: 'https://www.example-theater-site.com/seance/salle_gen_csalle=C0099.html',
      });

      expect(mockDb.query).toHaveBeenCalledOnce();
      // Use standard vitest expectation without casting to string array since arguments are unknown[]
      const params = mockDb.query.mock.calls[0][1] as unknown[];
      expect(params).toContain('https://www.example-theater-site.com/seance/salle_gen_csalle=C0099.html');
    });
  });
});
