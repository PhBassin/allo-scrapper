import { describe, it, expect, vi } from 'vitest';
import { getShowtimesByFilmAndWeek, getWeeklyShowtimes } from './queries.js';
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

  describe('getWeeklyShowtimes', () => {
    it('should return all showtimes for a week', async () => {
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
              week_start: '2026-02-18',
              cinema_name: 'Cinema 1'
            },
            {
              id: 's2',
              film_id: 456,
              cinema_id: 'C0001',
              date: '2026-02-18',
              time: '16:00',
              datetime_iso: '2026-02-18T16:00:00Z',
              version: 'VOST',
              week_start: '2026-02-18',
              cinema_name: 'Cinema 1'
            }
          ]
        })
      } as unknown as DB;

      const result = await getWeeklyShowtimes(mockDb, '2026-02-18');

      expect(result).toHaveLength(2);
      expect(result[0].film_id).toBe(123);
      expect(result[1].film_id).toBe(456);
      expect(result[0].cinema.name).toBe('Cinema 1');
    });
  });
});
