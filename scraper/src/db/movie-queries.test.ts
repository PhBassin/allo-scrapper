import { describe, it, expect, vi } from 'vitest';
import { getMovie, upsertMovie } from './movie-queries.js';
import type { DB } from './client.js';

describe('Scraper Movie Queries', () => {
  it('persists trailer_url when upserting a movie', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = { query: queryMock } as unknown as DB;

    await upsertMovie(mockDb, {
      id: 123,
      title: 'Movie test',
      genres: [],
      actors: [],
      source_url: 'https://example.com/movie',
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html',
    } as any);

    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(params[17]).toBe('https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html');
  });

  it('returns trailer_url when fetching a movie', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 123,
            title: 'Movie test',
            original_title: null,
            poster_url: null,
            duration_minutes: null,
            release_date: null,
            rerelease_date: null,
            genres: '[]',
            nationality: null,
            director: null,
            screenwriters: '[]',
            actors: '[]',
            synopsis: null,
            certificate: null,
            press_rating: null,
            audience_rating: null,
            source_url: 'https://example.com/movie',
            trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html',
          },
        ],
      }),
    } as unknown as DB;

    const movie = await getMovie(mockDb, 123);

    expect((movie as any)?.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html'
    );
  });

  it('uses COALESCE when updating trailer_url to prevent null overwrite', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = { query: queryMock } as unknown as DB;

    await upsertMovie(mockDb, {
      id: 123,
      title: 'Movie test',
      genres: [],
      actors: [],
      source_url: 'https://example.com/movie',
    } as any);

    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain('trailer_url = COALESCE($18, movies.trailer_url)');
  });
});
