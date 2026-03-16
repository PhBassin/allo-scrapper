import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilmService } from './film-service.js';
import * as filmQueries from '../db/film-queries.js';
import * as showtimeQueries from '../db/showtime-queries.js';
import { type DB } from '../db/client.js';

vi.mock('../db/film-queries.js');
vi.mock('../db/showtime-queries.js');
vi.mock('../utils/showtimes.js', () => ({
  groupShowtimesByCinema: vi.fn().mockImplementation((s) => s),
}));

describe('FilmService', () => {
  let filmService: FilmService;
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    filmService = new FilmService(mockDb);
  });

  describe('getFilmsForWeek', () => {
    it('should fetch and merge films and showtimes', async () => {
      vi.mocked(filmQueries.getWeeklyFilms).mockResolvedValue([{ id: 1 }] as any);
      vi.mocked(showtimeQueries.getWeeklyShowtimes).mockResolvedValue([{ film_id: 1, id: 's1' }] as any);

      const result = await filmService.getFilmsForWeek('2026-03-11');

      expect(result).toHaveLength(1);
      expect(result[0].cinemas).toBeDefined();
    });
  });

  describe('getFilmsForDate', () => {
    it('should fetch and merge films and showtimes for a date', async () => {
      vi.mocked(filmQueries.getFilmsByDate).mockResolvedValue([{ id: 1 }] as any);
      vi.mocked(showtimeQueries.getShowtimesByDate).mockResolvedValue([{ film_id: 1, id: 's1' }] as any);

      const result = await filmService.getFilmsForDate('2026-03-12', '2026-03-11');

      expect(result).toHaveLength(1);
    });
  });

  describe('getFilmById', () => {
    it('should return null if film not found', async () => {
      vi.mocked(filmQueries.getFilm).mockResolvedValue(undefined);
      const result = await filmService.getFilmById(999, '2026-03-11');
      expect(result).toBeNull();
    });

    it('should return film with showtimes if found', async () => {
      vi.mocked(filmQueries.getFilm).mockResolvedValue({ id: 1, title: 'Film' } as any);
      vi.mocked(showtimeQueries.getShowtimesByFilmAndWeek).mockResolvedValue([{ id: 's1' }] as any);

      const result = await filmService.getFilmById(1, '2026-03-11');

      expect(result?.title).toBe('Film');
      expect(result?.cinemas).toBeDefined();
    });
  });

  describe('search', () => {
    it('should call searchFilms query', async () => {
      vi.mocked(filmQueries.searchFilms).mockResolvedValue([]);
      await filmService.search('test', 5);
      expect(filmQueries.searchFilms).toHaveBeenCalledWith(mockDb, 'test', 5);
    });
  });
});
