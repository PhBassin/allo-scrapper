import { describe, it, expect, vi } from 'vitest';
import { upsertShowtimes } from './queries.js';
import { type DB } from './client.js';
import type { Showtime } from '../types/scraper.js';

describe('Queries - upsertShowtimes', () => {
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
