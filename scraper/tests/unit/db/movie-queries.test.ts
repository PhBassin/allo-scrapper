import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../../../src/db/client.js';
import type { Movie } from '../../../src/types/scraper.js';
import { getMovie, upsertMovie } from '../../../src/db/movie-queries.js';
import { logger } from '../../../src/utils/logger.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createMockDb(): DB {
  return {
    query: vi.fn(),
  } as unknown as DB;
}

const movieRow = {
  id: 100,
  title: 'Le Film',
  original_title: null,
  poster_url: 'https://example.com/poster.jpg',
  duration_minutes: 120,
  release_date: '2026-11-04',
  rerelease_date: null,
  genres: '["Drame","Comédie"]',
  nationality: null,
  director: 'Jane Doe',
  screenwriters: null,
  actors: '["Actor One"]',
  synopsis: null,
  certificate: null,
  press_rating: 3.5,
  audience_rating: null,
  source_url: 'https://example.com/film',
  trailer_url: null,
};

describe('Movie Queries', () => {
  let db: DB;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('getMovie', () => {
    it('maps the row, parsing JSON arrays and turning NULL into undefined', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [movieRow], rowCount: 1 } as any);

      const movie = await getMovie(db, 100);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM movies WHERE id = $1', [100]);
      expect(movie).toMatchObject({
        id: 100,
        title: 'Le Film',
        original_title: undefined,
        duration_minutes: 120,
        genres: ['Drame', 'Comédie'],
        screenwriters: [],
        actors: ['Actor One'],
        press_rating: 3.5,
        audience_rating: undefined,
        trailer_url: undefined,
      });
    });

    it('returns undefined when the movie does not exist', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      expect(await getMovie(db, 999)).toBeUndefined();
    });
  });

  describe('upsertMovie', () => {
    const movie = {
      id: 100,
      title: 'Le Film',
      genres: ['Drame'],
      actors: ['Actor One'],
      source_url: 'https://example.com/film',
    } as Movie;

    beforeEach(() => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);
      vi.mocked(logger.warn).mockClear();
    });

    it('keeps finite numeric values', async () => {
      await upsertMovie(db, { ...movie, duration_minutes: 120, press_rating: 3.5, audience_rating: 4.2 });

      const [, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect([values[4], values[14], values[15]]).toEqual([120, 3.5, 4.2]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stores NaN and Infinity as NULL and logs a warning', async () => {
      await upsertMovie(db, { ...movie, duration_minutes: NaN, press_rating: Infinity, audience_rating: 4.2 });

      const [, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect([values[4], values[14], values[15]]).toEqual([null, null, 4.2]);
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('stores missing optional fields as NULL and serializes arrays', async () => {
      await upsertMovie(db, movie);

      const [, values] = vi.mocked(db.query).mock.calls[0] as unknown as [string, unknown[]];
      expect(values[2]).toBeNull();
      expect(values[7]).toBe('["Drame"]');
      expect(values[10]).toBe('[]');
      expect(values[11]).toBe('["Actor One"]');
    });
  });
});
