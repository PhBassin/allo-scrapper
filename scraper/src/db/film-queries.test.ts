import { describe, it, expect, vi } from 'vitest';
import { getFilm, upsertFilm } from './film-queries.js';
import type { DB } from './client.js';

describe('Scraper Film Queries', () => {
  it('persists trailer_url when upserting a film', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = { query: queryMock } as unknown as DB;

    await upsertFilm(mockDb, {
      id: 123,
      title: 'Film test',
      genres: [],
      actors: [],
      source_url: 'https://example.com/film',
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html',
    } as any);

    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(params[17]).toBe('https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html');
  });

  it('returns trailer_url when fetching a film', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 123,
            title: 'Film test',
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
            source_url: 'https://example.com/film',
            trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html',
          },
        ],
      }),
    } as unknown as DB;

    const film = await getFilm(mockDb, 123);

    expect((film as any)?.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=123.html'
    );
  });
});
