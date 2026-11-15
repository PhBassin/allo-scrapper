import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../../../src/db/client.js';
import type { Showtime, WeeklyProgram } from '../../../src/types/scraper.js';
import { upsertShowtimes, upsertWeeklyPrograms } from '../../../src/db/showtime-queries.js';

function createMockDb(): DB {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  } as unknown as DB;
}

const showtime: Showtime = {
  id: 'S1',
  movie_id: 100,
  theater_id: 'C0072',
  date: '2026-11-04',
  time: '20:30',
  datetime_iso: '2026-11-04T20:30:00+01:00',
  version: 'VF',
  format: 'Digital',
  experiences: ['Format.Projection.Digital'],
  week_start: '2026-11-04',
};

describe('Showtime Queries', () => {
  let db: DB;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('upsertShowtimes', () => {
    it('does nothing for an empty list', async () => {
      await upsertShowtimes(db, []);

      expect(db.query).not.toHaveBeenCalled();
    });

    it('inserts all showtimes in a single query', async () => {
      const second: Showtime = { ...showtime, id: 'S2', version: '', format: undefined, experiences: [] };

      await upsertShowtimes(db, [showtime, second]);

      expect(db.query).toHaveBeenCalledOnce();
      const [sql, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('($1, $2, $3, $4, $5, $6, $7, $8, $9, $10), ($11, $12');
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(values).toHaveLength(20);
      expect(values.slice(0, 10)).toEqual([
        'S1', 100, 'C0072', '2026-11-04', '20:30', '2026-11-04T20:30:00+01:00',
        'VF', 'Digital', '["Format.Projection.Digital"]', '2026-11-04',
      ]);
      // Empty version and missing format are stored as NULL.
      expect(values.slice(16, 19)).toEqual([null, null, '[]']);
    });
  });

  describe('upsertWeeklyPrograms', () => {
    const program: WeeklyProgram = {
      theater_id: 'C0072',
      movie_id: 100,
      week_start: '2026-11-04',
      is_new_this_week: true,
      scraped_at: '2026-11-04T08:00:00Z',
    };

    it('does nothing for an empty list', async () => {
      await upsertWeeklyPrograms(db, []);

      expect(db.query).not.toHaveBeenCalled();
    });

    it('inserts programs and stores is_new_this_week as 1/0', async () => {
      await upsertWeeklyPrograms(db, [program, { ...program, movie_id: 101, is_new_this_week: false }]);

      const [sql, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)');
      expect(sql).toContain('ON CONFLICT(theater_id, movie_id, week_start)');
      expect(values).toEqual([
        'C0072', 100, '2026-11-04', 1, '2026-11-04T08:00:00Z',
        'C0072', 101, '2026-11-04', 0, '2026-11-04T08:00:00Z',
      ]);
    });
  });
});
