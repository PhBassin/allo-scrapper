import { describe, it, expect, vi } from 'vitest';
import { getFilm, searchFilms, upsertFilm } from './film-queries.js';
import { type DB } from './client.js';

describe('Film Queries - Film Search', () => {
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
              screenwriters: '["Lana Wachowski","Lilly Wachowski"]',
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
              screenwriters: '[]',
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
              screenwriters: '[]',
              genres: '[]',
              actors: '[]'
            },
            {
              id: 2,
              title: 'Super Mario Bros',
              screenwriters: '[]',
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
            screenwriters: '[]',
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
              screenwriters: '[]',
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

    it('should return films with very permissive fuzzy matching (low similarity threshold)', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 1,
              title: 'Marty',
              original_title: 'Marty',
              screenwriters: '[]',
              genres: '[]',
              actors: '[]'
            },
            {
              id: 2,
              title: 'La Mer',
              original_title: null,
              screenwriters: '[]',
              genres: '[]',
              actors: '[]'
            }
          ]
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'mer', 10);

      expect(result.length).toBeGreaterThan(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['mer', 10]
      );
      // Should use low similarity threshold (0.1) for permissive matching
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('0.1'),
        ['mer', 10]
      );
    });

    it('should search in original_title as well as title', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 19776,
              title: 'Matrix',
              original_title: 'The Matrix',
              screenwriters: '[]',
              genres: '[]',
              actors: '[]'
            }
          ]
        })
      } as unknown as DB;

      const result = await searchFilms(mockDb, 'The Matrix', 10);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Matrix');
      expect(result[0].original_title).toBe('The Matrix');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('original_title'),
        ['The Matrix', 10]
      );
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

describe('Film Queries - Film Sanitization', () => {
  describe('upsertFilm with invalid numeric values', () => {
    it('should handle NaN duration_minutes by converting to null', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] });
      const mockDb = {
        query: queryMock
      } as unknown as DB;

      const filmWithNaN = {
        id: 12345,
        title: 'Test Film',
        duration_minutes: NaN,
        press_rating: 4.0,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertFilm(mockDb, filmWithNaN);
      
      // Verify the query was called with null for duration_minutes
      expect(mockDb.query).toHaveBeenCalledOnce();
      const params: any[] = queryMock.mock.calls[0][1];
      // Parameter $5 is duration_minutes
      expect(params[4]).toBeNull();
    });

    it('should handle Infinity duration_minutes by converting to null', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] });
      const mockDb = {
        query: queryMock
      } as unknown as DB;

      const filmWithInfinity = {
        id: 12345,
        title: 'Test Film',
        duration_minutes: Infinity,
        press_rating: 4.0,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertFilm(mockDb, filmWithInfinity);
      
      // Verify the query was called with null for duration_minutes
      expect(mockDb.query).toHaveBeenCalledOnce();
      const params: any[] = queryMock.mock.calls[0][1];
      expect(params[4]).toBeNull();
    });

    it('should handle NaN press_rating by converting to null', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] });
      const mockDb = {
        query: queryMock
      } as unknown as DB;

      const filmWithNaNRating = {
        id: 12345,
        title: 'Test Film',
        duration_minutes: 120,
        press_rating: NaN,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertFilm(mockDb, filmWithNaNRating);
      
      // Verify the query was called with null for press_rating
      expect(mockDb.query).toHaveBeenCalledOnce();
      const params: any[] = queryMock.mock.calls[0][1];
      // Parameter $15 is press_rating
      expect(params[14]).toBeNull();
    });

    it('should handle NaN audience_rating by converting to null', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] });
      const mockDb = {
        query: queryMock
      } as unknown as DB;

      const filmWithNaNAudience = {
        id: 12345,
        title: 'Test Film',
        duration_minutes: 120,
        press_rating: 4.0,
        audience_rating: NaN,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertFilm(mockDb, filmWithNaNAudience);
      
      // Verify the query was called with null for audience_rating
      expect(mockDb.query).toHaveBeenCalledOnce();
      const params: any[] = queryMock.mock.calls[0][1];
      // Parameter $16 is audience_rating
      expect(params[15]).toBeNull();
    });

    it('should preserve valid numeric values', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] });
      const mockDb = {
        query: queryMock
      } as unknown as DB;

      const validFilm = {
        id: 12345,
        title: 'Test Film',
        duration_minutes: 120,
        press_rating: 4.0,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertFilm(mockDb, validFilm);
      
      // Verify valid values are preserved
      expect(mockDb.query).toHaveBeenCalledOnce();
      const params: any[] = queryMock.mock.calls[0][1];
      expect(params[4]).toBe(120);      // duration_minutes
      expect(params[14]).toBe(4.0);     // press_rating
      expect(params[15]).toBe(3.5);     // audience_rating
    });
  });
});

describe('Film Queries - Trailer URL', () => {
  it('should persist trailer_url when upserting a film', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = {
      query: queryMock,
    } as unknown as DB;

    await upsertFilm(mockDb, {
      id: 987,
      title: 'Trailer Film',
      genres: [],
      actors: [],
      source_url: 'https://example.com/film/987',
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html',
    } as any);

    const params: any[] = queryMock.mock.calls[0][1];
    expect(params[17]).toBe('https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html');
  });

  it('should return trailer_url when fetching a film', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 987,
            title: 'Trailer Film',
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
            source_url: 'https://example.com/film/987',
            trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html',
          },
        ],
      }),
    } as unknown as DB;

    const film = await getFilm(mockDb, 987);
    expect((film as any)?.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html'
    );
  });

  it('should preserve existing trailer_url when upsert input trailer_url is null', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = {
      query: queryMock,
    } as unknown as DB;

    await upsertFilm(mockDb, {
      id: 987,
      title: 'Trailer Film',
      genres: [],
      actors: [],
      source_url: 'https://example.com/film/987',
    } as any);

    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain('trailer_url = COALESCE($18, films.trailer_url)');
  });
});
