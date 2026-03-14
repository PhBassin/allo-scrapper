import { describe, it, expect, vi } from 'vitest';
import { getShowtimesByFilmAndWeek, upsertShowtimes } from './showtime-queries.js';
import { type DB } from './client.js';
import type { Showtime } from '../types/scraper.js';

describe('Showtime Queries', () => {
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

  describe('upsertShowtimes', () => {
    it('should batch insert multiple showtimes with correct SQL', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rowCount: 2 }),
      } as unknown as DB;

      const showtimes: Showtime[] = [
        {
          id: 'S1',
          film_id: 101,
          cinema_id: 'C1',
          date: '2023-01-01',
          time: '12:00',
          datetime_iso: '2023-01-01T12:00:00Z',
          version: 'VF',
          format: 'Digital',
          experiences: ['Standard'],
          week_start: '2022-12-28',
        },
        {
          id: 'S2',
          film_id: 101,
          cinema_id: 'C1',
          date: '2023-01-01',
          time: '15:00',
          datetime_iso: '2023-01-01T15:00:00Z',
          version: 'VO',
          format: 'IMAX',
          experiences: ['IMAX'],
          week_start: '2022-12-28',
        },
      ];

      await upsertShowtimes(mockDb, showtimes);

      expect(mockDb.query).toHaveBeenCalledTimes(1);

      const [sql, values] = mockDb.query.mock.calls[0];

      // Check SQL structure
      expect(sql).toContain('INSERT INTO showtimes');
      expect(sql).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10), ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20)');
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE SET');
      expect(sql).toContain('date = EXCLUDED.date');
      expect(sql).toContain('experiences = EXCLUDED.experiences');

      // Check values
      expect(values).toHaveLength(20);
      expect(values[0]).toBe('S1');
      expect(values[10]).toBe('S2');
      expect(JSON.parse(values[8])).toEqual(['Standard']);
      expect(JSON.parse(values[18])).toEqual(['IMAX']);
    });

    it('should do nothing if showtimes array is empty', async () => {
      const mockDb = {
        query: vi.fn(),
      } as unknown as DB;

      await upsertShowtimes(mockDb, []);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
