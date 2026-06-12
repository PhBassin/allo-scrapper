import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMovie, searchMovies, upsertMovie, formatMovieRow } from './movie-queries.js';
import { type DB } from './client.js';
import { resetJSONParseCache } from '../utils/json-parse-cache.js';

describe('Movie Queries - Movie Search', () => {
  describe('searchMovies', () => {
    it('should return movies with exact match', async () => {
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

      const result = await searchMovies(mockDb, 'Matrix', 10);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Matrix');
      expect(result[0].genres).toEqual(['Science Fiction', 'Action']);
      expect(result[0].actors).toEqual(['Keanu Reeves', 'Laurence Fishburne']);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['Matrix', 10]
      );
    });

    it('should return movies with typos using fuzzy matching', async () => {
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

      const result = await searchMovies(mockDb, 'Matix', 10); // Typo: missing 'r'

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Matrix');
    });

    it('should return movies with partial match', async () => {
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

      const result = await searchMovies(mockDb, 'super', 10);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.title)).toContain('Superman');
      expect(result.map(f => f.title)).toContain('Super Mario Bros');
    });

    it('should limit results to specified limit', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: Array.from({ length: 5 }, (_, i) => ({
            id: i,
            title: `Movie ${i}`,
            screenwriters: '[]',
            genres: '[]',
            actors: '[]'
          }))
        })
      } as unknown as DB;

      const result = await searchMovies(mockDb, 'Movie', 5);

      expect(result).toHaveLength(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['Movie', 5]
      );
    });

    it('should return empty array when no matches found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      } as unknown as DB;

      const result = await searchMovies(mockDb, 'xyz123notfound', 10);

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

      const result = await searchMovies(mockDb, "L'Été", 10);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('L\'Été');
    });

    it('should return movies with very permissive fuzzy matching (low similarity threshold)', async () => {
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

      const result = await searchMovies(mockDb, 'mer', 10);

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

      const result = await searchMovies(mockDb, 'The Matrix', 10);

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

      await searchMovies(mockDb, 'test');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['test', 10]
      );
    });
  });
});

describe('Movie Queries - Movie Sanitization', () => {
  describe('upsertMovie with invalid numeric values', () => {
    it('should handle NaN duration_minutes by converting to null', async () => {
      const queryMock = vi.fn().mockResolvedValue({ rows: [] });
      const mockDb = {
        query: queryMock
      } as unknown as DB;

      const movieWithNaN = {
        id: 12345,
        title: 'Test Movie',
        duration_minutes: NaN,
        press_rating: 4.0,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertMovie(mockDb, movieWithNaN);
      
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

      const movieWithInfinity = {
        id: 12345,
        title: 'Test Movie',
        duration_minutes: Infinity,
        press_rating: 4.0,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertMovie(mockDb, movieWithInfinity);
      
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

      const movieWithNaNRating = {
        id: 12345,
        title: 'Test Movie',
        duration_minutes: 120,
        press_rating: NaN,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertMovie(mockDb, movieWithNaNRating);
      
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

      const movieWithNaNAudience = {
        id: 12345,
        title: 'Test Movie',
        duration_minutes: 120,
        press_rating: 4.0,
        audience_rating: NaN,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertMovie(mockDb, movieWithNaNAudience);
      
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

      const validMovie = {
        id: 12345,
        title: 'Test Movie',
        duration_minutes: 120,
        press_rating: 4.0,
        audience_rating: 3.5,
        genres: [],
        actors: [],
        source_url: 'https://example.com',
      };

      await upsertMovie(mockDb, validMovie);
      
      // Verify valid values are preserved
      expect(mockDb.query).toHaveBeenCalledOnce();
      const params: any[] = queryMock.mock.calls[0][1];
      expect(params[4]).toBe(120);      // duration_minutes
      expect(params[14]).toBe(4.0);     // press_rating
      expect(params[15]).toBe(3.5);     // audience_rating
    });
  });
});

describe('Movie Queries - Trailer URL', () => {
  it('should persist trailer_url when upserting a movie', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = {
      query: queryMock,
    } as unknown as DB;

    await upsertMovie(mockDb, {
      id: 987,
      title: 'Trailer Movie',
      genres: [],
      actors: [],
      source_url: 'https://example.com/movie/987',
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html',
    } as any);

    const params: any[] = queryMock.mock.calls[0][1];
    expect(params[17]).toBe('https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html');
  });

  it('should return trailer_url when fetching a movie', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 987,
            title: 'Trailer Movie',
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
            source_url: 'https://example.com/movie/987',
            trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html',
          },
        ],
      }),
    } as unknown as DB;

    const movie = await getMovie(mockDb, 987);
    expect((movie as any)?.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=987.html'
    );
  });

  it('should preserve existing trailer_url when upsert input trailer_url is null', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockDb = {
      query: queryMock,
    } as unknown as DB;

    await upsertMovie(mockDb, {
      id: 987,
      title: 'Trailer Movie',
      genres: [],
      actors: [],
      source_url: 'https://example.com/movie/987',
    } as any);

    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain('trailer_url = COALESCE($18, movies.trailer_url)');
  });
});

describe('Movie Queries - formatMovieRow', () => {
  beforeEach(() => {
    resetJSONParseCache();
  });

  it('should map a complete MovieRow to Movie', () => {
    const row = {
      id: 42,
      title: 'Inception',
      original_title: 'Inception',
      poster_url: 'https://img.example.com/inception.jpg',
      duration_minutes: 148,
      release_date: '2010-07-21',
      rerelease_date: '2020-07-15',
      genres: '["Science Fiction","Thriller"]',
      nationality: 'U.S.A.',
      director: 'Christopher Nolan',
      screenwriters: '["Christopher Nolan"]',
      actors: '["Leonardo DiCaprio","Joseph Gordon-Levitt"]',
      synopsis: 'A thief enters dreams',
      certificate: 'Tous publics',
      press_rating: 4.5,
      audience_rating: 4.8,
      source_url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=143692.html',
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=19555755&cfilm=143692.html',
    };

    const movie = formatMovieRow(row);

    expect(movie.id).toBe(42);
    expect(movie.title).toBe('Inception');
    expect(movie.original_title).toBe('Inception');
    expect(movie.poster_url).toBe('https://img.example.com/inception.jpg');
    expect(movie.duration_minutes).toBe(148);
    expect(movie.release_date).toBe('2010-07-21');
    expect(movie.rerelease_date).toBe('2020-07-15');
    expect(movie.genres).toEqual(['Science Fiction', 'Thriller']);
    expect(movie.nationality).toBe('U.S.A.');
    expect(movie.director).toBe('Christopher Nolan');
    expect(movie.screenwriters).toEqual(['Christopher Nolan']);
    expect(movie.actors).toEqual(['Leonardo DiCaprio', 'Joseph Gordon-Levitt']);
    expect(movie.synopsis).toBe('A thief enters dreams');
    expect(movie.certificate).toBe('Tous publics');
    expect(movie.press_rating).toBe(4.5);
    expect(movie.audience_rating).toBe(4.8);
    expect(movie.source_url).toBe('https://www.allocine.fr/film/fichefilm_gen_cfilm=143692.html');
    expect(movie.trailer_url).toBe('https://www.allocine.fr/video/player_gen_cmedia=19555755&cfilm=143692.html');
  });

  it('should convert null fields to undefined', () => {
    const row = {
      id: 1,
      title: 'Minimal Movie',
      original_title: null,
      poster_url: null,
      duration_minutes: null,
      release_date: null,
      rerelease_date: null,
      genres: '[]',
      nationality: null,
      director: null,
      screenwriters: null,
      actors: '[]',
      synopsis: null,
      certificate: null,
      press_rating: null,
      audience_rating: null,
      source_url: 'https://example.com',
      trailer_url: null,
    };

    const movie = formatMovieRow(row);

    expect(movie.original_title).toBeUndefined();
    expect(movie.poster_url).toBeUndefined();
    expect(movie.duration_minutes).toBeUndefined();
    expect(movie.release_date).toBeUndefined();
    expect(movie.rerelease_date).toBeUndefined();
    expect(movie.nationality).toBeUndefined();
    expect(movie.director).toBeUndefined();
    expect(movie.synopsis).toBeUndefined();
    expect(movie.certificate).toBeUndefined();
    expect(movie.press_rating).toBeUndefined();
    expect(movie.audience_rating).toBeUndefined();
    expect(movie.trailer_url).toBeUndefined();
  });

  it('should parse JSON fields (genres, screenwriters, actors) via parseJSONMemoized', () => {
    const row = {
      id: 1,
      title: 'Ensemble',
      genres: '["Comedy","Drama"]',
      screenwriters: '["Alice","Bob"]',
      actors: '["Charlie","Dana"]',
      source_url: 'https://example.com',
    } as Parameters<typeof formatMovieRow>[0];

    const movie = formatMovieRow(row);

    expect(movie.genres).toEqual(['Comedy', 'Drama']);
    expect(movie.screenwriters).toEqual(['Alice', 'Bob']);
    expect(movie.actors).toEqual(['Charlie', 'Dana']);
  });

  it('should return empty arrays for null/empty JSON fields', () => {
    const row = {
      id: 1,
      title: 'No Data',
      genres: null,
      screenwriters: '',
      actors: null,
      source_url: 'https://example.com',
    } as Parameters<typeof formatMovieRow>[0];

    const movie = formatMovieRow(row);

    expect(movie.genres).toEqual([]);
    expect(movie.screenwriters).toEqual([]);
    expect(movie.actors).toEqual([]);
  });

  it('should keep source_url as-is (never null-coalesced)', () => {
    const row = {
      id: 1,
      title: 'Source URL Test',
      source_url: 'https://example.com/movie/1',
      genres: '[]',
      actors: '[]',
    } as Parameters<typeof formatMovieRow>[0];

    const movie = formatMovieRow(row);
    expect(movie.source_url).toBe('https://example.com/movie/1');
  });

  it('should deep-clone array fields so callers cannot mutate shared state', () => {
    const row = {
      id: 1,
      title: 'Shared State',
      genres: '["Action"]',
      actors: '["Foo"]',
      screenwriters: null,
      source_url: 'https://example.com',
    } as Parameters<typeof formatMovieRow>[0];

    const movie1 = formatMovieRow(row);
    const movie2 = formatMovieRow(row);

    movie1.genres.push('Thriller');
    expect(movie2.genres).toEqual(['Action']);
    expect(movie1.genres).toEqual(['Action', 'Thriller']);
  });
});
