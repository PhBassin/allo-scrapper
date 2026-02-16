import { describe, it, expect, vi } from 'vitest';
import { getShowtimesByFilmAndWeek } from './queries.js';
import { type DB } from './client.js';

describe('Queries - getShowtimesByFilmAndWeek', () => {
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
          },
          {
            id: 's2',
            film_id: 123,
            cinema_id: 'C0002',
            date: '2026-02-18',
            time: '20:00',
            datetime_iso: '2026-02-18T20:00:00Z',
            version: 'VOST',
            format: 'IMAX',
            experiences: '[]',
            week_start: '2026-02-18',
            cinema_name: 'Cinema 2',
            cinema_address: 'Address 2',
            postal_code: '75002',
            city: 'Paris',
            screen_count: 10,
            image_url: 'img2.jpg'
          }
        ]
      })
    } as unknown as DB;

    const result = await getShowtimesByFilmAndWeek(mockDb, 123, '2026-02-18');

    expect(result).toHaveLength(2);
    expect(result[0].cinema).toBeDefined();
    expect(result[0].cinema.name).toBe('Cinema 1');
    expect(result[1].cinema.name).toBe('Cinema 2');
    expect(result[0].version).toBe('VF');
    expect(Array.isArray(result[0].experiences)).toBe(true);
  });
});
