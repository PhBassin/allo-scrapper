import { describe, it, expect, vi } from 'vitest';
import { getShowtimesByFilmAndWeek, getWeeklyShowtimes, getCinemaConfigs, addCinema, updateCinemaConfig, deleteCinema, upsertCinema, searchFilms } from './queries.js';
import { type DB } from './client.js';

describe('Queries - Showtimes', () => {
  describe('getShowtimesByFilmAndWeek', () => {
    it('should return showtimes grouped by cinema', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 's1',
              film_id: 123,
              cinema_id: 'C0001',
              date: '2026-02-18',
              time: '14:00',
              datetime_iso: '2026-02-18T14:00:00Z',
              version: 'VF',
              format: 'Digital',
              experiences: '["3D"]',
              week_start: '2026-02-18',
              cinema_name: 'Cinema 1',
              cinema_address: 'Address 1',
              postal_code: '75001',
              city: 'Paris',
              screen_count: 5,
              image_url: 'img1.jpg'
            }
          ]
        })
      } as unknown as DB;

      const result = await getShowtimesByFilmAndWeek(mockDb, 123, '2026-02-18');

      expect(result).toHaveLength(1);
      expect(result[0].cinema).toBeDefined();
      expect(result[0].cinema.name).toBe('Cinema 1');
      expect(result[0].experiences).toEqual(['3D']);
    });

    it('should return empty array when no showtimes found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await getShowtimesByFilmAndWeek(mockDb, 999, '2026-02-18');
      expect(result).toEqual([]);
    });

    it('should handle malformed experiences JSON', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 's1',
              experiences: null, // should default to empty array
              cinema_id: 'C0001',
              experiences_json: null
            }
          ]
        })
      } as unknown as DB;

      const result = await getShowtimesByFilmAndWeek(mockDb, 123, '2026-02-18');
      expect(result[0].experiences).toEqual([]);
    });
  });
});

describe('Queries - Film Search', () => {
  describe('searchFilms', () => {
    it('should return films with exact match', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 19776,
              title: 'Matrix',
              original_title: 'The Matrix',
              poster_url: 'matrix.jpg',
              duration_minutes: 136,
              release_date: '1999-06-23',
              rerelease_date: null,
              genres: '["Science Fiction","Action"]',
              nationality: 'U.S.A.',
              director: 'Lana Wachowski, Lilly Wachowski',
              actors: '["Keanu Reeves","Laurence Fishburne"]',
              synopsis: 'A computer hacker learns...',
              certificate: 'Tous publics',
              press_rating: 4.5,
              audience_rating: 4.7,
              source_url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=19776.html'
            }
          ]
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'Matrix', 10);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Matrix');
      expect(result[0].genres).toEqual(['Science Fiction', 'Action']);
      expect(result[0].actors).toEqual(['Keanu Reeves', 'Laurence Fishburne']);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['Matrix', 10]
      );
    });

    it('should return films with typos using fuzzy matching', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 19776,
              title: 'Matrix',
              genres: '["Science Fiction"]',
              actors: '[]'
            }
          ]
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'Matix', 10); // Typo: missing 'r'

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Matrix');
    });

    it('should return films with partial match', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 1,
              title: 'Superman',
              genres: '[]',
              actors: '[]'
            },
            {
              id: 2,
              title: 'Super Mario Bros',
              genres: '[]',
              actors: '[]'
            }
          ]
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'super', 10);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.title)).toContain('Superman');
      expect(result.map(f => f.title)).toContain('Super Mario Bros');
    });

    it('should limit results to specified limit', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: Array.from({ length: 5 }, (_, i) => ({
            id: i,
            title: `Film ${i}`,
            genres: '[]',
            actors: '[]'
          }))
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'Film', 5);

      expect(result).toHaveLength(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['Film', 5]
      );
    });

    it('should return empty array when no matches found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'xyz123notfound', 10);

      expect(result).toEqual([]);
    });

    it('should handle special characters in query', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 123,
              title: 'L\'Été',
              genres: '[]',
              actors: '[]'
            }
          ]
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, "L'Été", 10);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('L\'Été');
    });

    it('should use default limit of 10 when not specified', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      await searchFilms(mockDb, 'test');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['test', 10]
      );
    });
  });
});

describe('Queries - Cinemas', () => {
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
      const params: any[] = mockDb.query.mock.calls[0][1];
      expect(params).toContain('https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html');
    });
  });
});
