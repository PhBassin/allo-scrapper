import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/client.js';
import * as queries from '../db/showtime-queries.js';
import * as filmQueries from '../db/film-queries.js';
import * as dateUtils from '../utils/date.js';
import router from './films.js';

// Mock the dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/showtime-queries.js', () => ({
  getShowtimesByDate: vi.fn(),
  getShowtimesByFilmAndWeek: vi.fn(),
  getWeeklyShowtimes: vi.fn(),
}));

vi.mock('../db/film-queries.js', () => ({
  getWeeklyFilms: vi.fn(),
  getFilmsByDate: vi.fn(),
  getFilm: vi.fn(),
  searchFilms: vi.fn(),
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

// Helper to get the actual route handler (skips middleware like rate limiters)
function getRouteHandler(path: string, method: 'get' | 'post' | 'put' | 'delete') {
  const route = router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route;
  return route?.stack[route.stack.length - 1]?.handle;
}

describe('Routes - Films', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;
  let mockApp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = {
      get: vi.fn((key: string) => {
        if (key === 'db') return db;
        return undefined;
      })
    };
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn((err?: any) => {
      if (err) {
        mockRes.status(err.statusCode || 500).json({ success: false, error: err.message });
      }
    });
  });

  describe('GET /', () => {
    it('should return weekly films with showtimes', async () => {
      mockReq = { query: {}, app: mockApp };
      const mockFilms = [{ id: 1, title: 'Film 1' }];
      const mockShowtimes = [
        { id: 's1', film_id: 1, cinema_id: 'C1', cinema: { id: 'C1', name: 'Cinema 1' } }
      ];

      (filmQueries.getWeeklyFilms as any).mockResolvedValue(mockFilms);
      (queries.getWeeklyShowtimes as any).mockResolvedValue(mockShowtimes);

      // We need to call the handler. Express router makes it hard to call directly.
      // In a real test we'd use supertest. Here we'll find the handler.
      const handler = getRouteHandler('/', 'get');

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.films[0].cinemas).toHaveLength(1);
      expect(response.data.films[0].cinemas[0].id).toBe('C1');
    });

    it('should handle errors', async () => {
      mockReq = { query: {}, app: mockApp };
      const error = new Error('DB Error');
      (filmQueries.getWeeklyFilms as any).mockRejectedValue(error);

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      // OLD BEHAVIOR: expect(mockRes.status).toHaveBeenCalledWith(500);
      // NEW BEHAVIOR: expect(mockNext).toHaveBeenCalledWith(error);

      expect(mockNext).toHaveBeenCalledWith(error);
      // Removed mockRes.status reverse check as mockNext now propagates it // Should not manually handle error
    });
  });

  describe('GET / with date filter', () => {
    it('should return films for a specific date', async () => {
      mockReq = { query: { date: '2026-02-20' }, app: mockApp };
      const mockFilms = [{ id: 1, title: 'Film 1' }];
      const mockShowtimes = [
        { id: 's1', film_id: 1, cinema_id: 'C1', cinema: { id: 'C1', name: 'Cinema 1' }, date: '2026-02-20' }
      ];

      (filmQueries.getFilmsByDate as any).mockResolvedValue(mockFilms);
      (queries.getShowtimesByDate as any).mockResolvedValue(mockShowtimes);

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(filmQueries.getFilmsByDate).toHaveBeenCalledWith(db, '2026-02-20', '2026-02-18');
      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.films[0].cinemas).toHaveLength(1);
      expect(response.data.date).toBe('2026-02-20');
    });

    it('should return 400 for invalid date format', async () => {
      mockReq = { query: { date: 'invalid-date' }, app: mockApp };
      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('date')
      }));
    });
  });

  describe('GET /:id', () => {
    it('should return film by ID with showtimes', async () => {
      mockReq = { params: { id: '1' }, app: mockApp };
      const mockFilm = { id: 1, title: 'Film 1' };
      const mockShowtimes = [
        { id: 's1', film_id: 1, cinema_id: 'C1', cinema: { id: 'C1', name: 'Cinema 1' } }
      ];

      (filmQueries.getFilm as any).mockResolvedValue(mockFilm);
      (queries.getShowtimesByFilmAndWeek as any).mockResolvedValue(mockShowtimes);

      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.cinemas).toHaveLength(1);
    });

    it('should return 400 for invalid ID', async () => {
      mockReq = { params: { id: 'abc' }, app: mockApp };
      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent film', async () => {
      mockReq = { params: { id: '99' }, app: mockApp };
      (filmQueries.getFilm as any).mockResolvedValue(null);

      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      mockReq = { params: { id: '1' }, app: mockApp };
      const error = new Error('DB Error');
      (filmQueries.getFilm as any).mockRejectedValue(error);

      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      // Removed mockRes.status reverse check as mockNext now propagates it
    });
  });

  describe('GET /search', () => {
    it('should return search results with valid query', async () => {
      mockReq = { query: { q: 'Matrix' }, app: mockApp };
      const mockFilms = [
        {
          id: 19776,
          title: 'Matrix',
          genres: ['Science Fiction', 'Action'],
          poster_url: 'matrix.jpg'
        }
      ];

      (filmQueries.searchFilms as any).mockResolvedValue(mockFilms);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(filmQueries.searchFilms).toHaveBeenCalledWith(db, 'Matrix', 10);
      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.films).toHaveLength(1);
      expect(response.data.films[0].title).toBe('Matrix');
      expect(response.data.query).toBe('Matrix');
    });

    it('should return 400 if query parameter is missing', async () => {
      mockReq = { query: {}, app: mockApp };
      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('at least 2 characters')
      }));
    });

    it('should return 400 if query is too short', async () => {
      mockReq = { query: { q: 'a' }, app: mockApp };
      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('at least 2 characters')
      }));
    });

    it('should return empty array when no results found', async () => {
      mockReq = { query: { q: 'xyz123notfound' }, app: mockApp };
      (filmQueries.searchFilms as any).mockResolvedValue([]);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.films).toEqual([]);
    });

    it('should handle errors', async () => {
      mockReq = { query: { q: 'test' }, app: mockApp };
      const error = new Error('DB Error');
      (filmQueries.searchFilms as any).mockRejectedValue(error);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      // Removed mockRes.status reverse check as mockNext now propagates it
    });

    it('should trim whitespace from query', async () => {
      mockReq = { query: { q: '  Matrix  ' }, app: mockApp };
      (filmQueries.searchFilms as any).mockResolvedValue([]);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(filmQueries.searchFilms).toHaveBeenCalledWith(db, 'Matrix', 10);
    });
  });
});
