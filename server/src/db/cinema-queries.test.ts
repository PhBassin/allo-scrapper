import { describe, it, expect, vi } from 'vitest';
import { getCinemas, getCinemaConfigs, addCinema, updateCinemaConfig, deleteCinema, upsertCinema } from './cinema-queries.js';
import { type DB } from './client.js';

describe('Cinema Queries', () => {
  describe('getCinemas', () => {
    it('should return all cinemas', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { id: '1', name: 'Cinema 1' },
            { id: '2', name: 'Cinema 2' }
          ]
        })
      } as unknown as DB;

      const result = await getCinemas(mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
    });
  });

  describe('getCinemaConfigs', () => {
    it('should return cinemas that have a url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { id: 'W7504', name: 'Épée de Bois', url: 'https://www.example-cinema-site.com/seance/salle_gen_csalle=W7504.html' },
            { id: 'C0072', name: 'Le Grand Action', url: 'https://www.example-cinema-site.com/seance/salle_gen_csalle=C0072.html' },
          ]
        })
      } as unknown as DB;

      const result = await getCinemaConfigs(mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('W7504');
      expect(result[0].url).toBe('https://www.example-cinema-site.com/seance/salle_gen_csalle=W7504.html');
    });

    it('should return empty array when no cinemas with url exist', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await getCinemaConfigs(mockDb);
      expect(result).toEqual([]);
    });

    it('should query only cinemas with non-null url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await getCinemaConfigs(mockDb);

      const sql: string = mockDb.query.mock.calls[0][0];
      expect(sql.toLowerCase()).toContain('url is not null');
    });
  });

  describe('addCinema', () => {
    it('should insert a new cinema with id, name and url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'C0099', name: 'New Cinema', url: 'https://example.com' }] })
      } as unknown as DB;

      const result = await addCinema(mockDb, { id: 'C0099', name: 'New Cinema', url: 'https://example.com' });

      expect(mockDb.query).toHaveBeenCalledOnce();
      expect(result.id).toBe('C0099');
    });

    it('should throw if cinema id already exists', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'))
      } as unknown as DB;

      await expect(addCinema(mockDb, { id: 'W7504', name: 'Duplicate', url: 'https://example.com' }))
        .rejects.toThrow();
    });
  });

  describe('updateCinemaConfig', () => {
    it('should update cinema name and url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'W7504', name: 'Updated', url: 'https://new-url.com' }] })
      } as unknown as DB;

      const result = await updateCinemaConfig(mockDb, 'W7504', { name: 'Updated', url: 'https://new-url.com' });

      expect(mockDb.query).toHaveBeenCalledOnce();
      expect(result?.id).toBe('W7504');
    });

    it('should return undefined when cinema not found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await updateCinemaConfig(mockDb, 'UNKNOWN', { name: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteCinema', () => {
    it('should delete a cinema and return true when found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 })
      } as unknown as DB;

      const result = await deleteCinema(mockDb, 'W7504');
      expect(result).toBe(true);
    });

    it('should return false when cinema not found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rowCount: 0 })
      } as unknown as DB;

      const result = await deleteCinema(mockDb, 'UNKNOWN');
      expect(result).toBe(false);
    });
  });

  describe('upsertCinema', () => {
    it('should preserve existing url via COALESCE when url is not provided', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await upsertCinema(mockDb, {
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

    it('should upsert cinema with all fields including url', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await upsertCinema(mockDb, {
        id: 'C0099',
        name: 'New Cinema',
        address: '5 Rue Test',
        postal_code: '75002',
        city: 'Paris',
        screen_count: 2,
        url: 'https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html',
      });

      expect(mockDb.query).toHaveBeenCalledOnce();
      // Use standard vitest expectation without casting to string array since arguments are unknown[]
      const params = mockDb.query.mock.calls[0][1] as unknown[];
      expect(params).toContain('https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html');
    });
  });
});
