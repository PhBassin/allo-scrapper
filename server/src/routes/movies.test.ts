import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/client.js';
import * as queries from '../db/showtime-queries.js';
import * as movieQueries from '../db/movie-queries.js';
import * as dateUtils from '../utils/date.js';
import router from './movies.js';

// Mock the dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/showtime-queries.js', () => ({
  getShowtimesByDate: vi.fn(),
  getShowtimesByMovieAndWeek: vi.fn(),
  getWeeklyShowtimes: vi.fn(),
}));

vi.mock('../db/movie-queries.js', () => ({
  getWeeklyMovies: vi.fn(),
  getMoviesByDate: vi.fn(),
  getMovie: vi.fn(),
  searchMovies: vi.fn(),
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

// Helper to get the actual route handler (skips middleware like rate limiters)
function getRouteHandler(path: string, method: 'get' | 'post' | 'put' | 'delete') {
  const route = router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route;
  return route?.stack[route.stack.length - 1]?.handle;
}

describe('Routes - Movies', () => {
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
    it('should return weekly movies with showtimes', async () => {
      mockReq = { query: {}, app: mockApp };
      const mockMovies = [{ id: 1, title: 'Movie 1' }];
      const mockShowtimes = [
        { id: 's1', movie_id: 1, theater_id: 'C1', theater: { id: 'C1', name: 'Theater 1' } }
      ];

      (movieQueries.getWeeklyMovies as any).mockResolvedValue(mockMovies);
      (queries.getWeeklyShowtimes as any).mockResolvedValue(mockShowtimes);

      // We need to call the handler. Express router makes it hard to call directly.
      // In a real test we'd use supertest. Here we'll find the handler.
      const handler = getRouteHandler('/', 'get');

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.movies[0].theaters).toHaveLength(1);
      expect(response.data.movies[0].theaters[0].id).toBe('C1');
    });

    it('should handle errors', async () => {
      mockReq = { query: {}, app: mockApp };
      const error = new Error('DB Error');
      (movieQueries.getWeeklyMovies as any).mockRejectedValue(error);

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      // OLD BEHAVIOR: expect(mockRes.status).toHaveBeenCalledWith(500);
      // NEW BEHAVIOR: expect(mockNext).toHaveBeenCalledWith(error);

      expect(mockNext).toHaveBeenCalledWith(error);
      // Removed mockRes.status reverse check as mockNext now propagates it // Should not manually handle error
    });
  });

  describe('GET / with date filter', () => {
    it('should return movies for a specific date', async () => {
      mockReq = { query: { date: '2026-02-20' }, app: mockApp };
      const mockMovies = [{ id: 1, title: 'Movie 1' }];
      const mockShowtimes = [
        { id: 's1', movie_id: 1, theater_id: 'C1', theater: { id: 'C1', name: 'Theater 1' }, date: '2026-02-20' }
      ];

      (movieQueries.getMoviesByDate as any).mockResolvedValue(mockMovies);
      (queries.getShowtimesByDate as any).mockResolvedValue(mockShowtimes);

      const handler = getRouteHandler('/', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(movieQueries.getMoviesByDate).toHaveBeenCalledWith(db, '2026-02-20', '2026-02-18');
      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.movies[0].theaters).toHaveLength(1);
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
    it('should return movie by ID with showtimes', async () => {
      mockReq = { params: { id: '1' }, app: mockApp };
      const mockMovie = { id: 1, title: 'Movie 1' };
      const mockShowtimes = [
        { id: 's1', movie_id: 1, theater_id: 'C1', theater: { id: 'C1', name: 'Theater 1' } }
      ];

      (movieQueries.getMovie as any).mockResolvedValue(mockMovie);
      (queries.getShowtimesByMovieAndWeek as any).mockResolvedValue(mockShowtimes);

      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.theaters).toHaveLength(1);
    });

    it('should return 400 for invalid ID', async () => {
      mockReq = { params: { id: 'abc' }, app: mockApp };
      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent movie', async () => {
      mockReq = { params: { id: '99' }, app: mockApp };
      (movieQueries.getMovie as any).mockResolvedValue(null);

      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      mockReq = { params: { id: '1' }, app: mockApp };
      const error = new Error('DB Error');
      (movieQueries.getMovie as any).mockRejectedValue(error);

      const handler = getRouteHandler('/:id', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      // Removed mockRes.status reverse check as mockNext now propagates it
    });
  });

  describe('GET /search', () => {
    it('should return search results with valid query', async () => {
      mockReq = { query: { q: 'Matrix' }, app: mockApp };
      const mockMovies = [
        {
          id: 19776,
          title: 'Matrix',
          genres: ['Science Fiction', 'Action'],
          poster_url: 'matrix.jpg'
        }
      ];

      (movieQueries.searchMovies as any).mockResolvedValue(mockMovies);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(movieQueries.searchMovies).toHaveBeenCalledWith(db, 'Matrix', 10);
      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.movies).toHaveLength(1);
      expect(response.data.movies[0].title).toBe('Matrix');
      expect(response.data.query).toBe('Matrix');
    });

    it('should return 400 if query parameter is missing', async () => {
      mockReq = { query: {}, app: mockApp };
      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('between 2 and 100 characters')
      }));
    });

    it('should return 400 if query is too long', async () => {
      mockReq = { query: { q: 'a'.repeat(101) }, app: mockApp };
      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('between 2 and 100 characters')
      }));
    });

    it('should return 400 if query is too short', async () => {
      mockReq = { query: { q: 'a' }, app: mockApp };
      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('between 2 and 100 characters')
      }));
    });

    it('should return empty array when no results found', async () => {
      mockReq = { query: { q: 'xyz123notfound' }, app: mockApp };
      (movieQueries.searchMovies as any).mockResolvedValue([]);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.movies).toEqual([]);
    });

    it('should handle errors', async () => {
      mockReq = { query: { q: 'test' }, app: mockApp };
      const error = new Error('DB Error');
      (movieQueries.searchMovies as any).mockRejectedValue(error);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      // Removed mockRes.status reverse check as mockNext now propagates it
    });

    it('should trim whitespace from query', async () => {
      mockReq = { query: { q: '  Matrix  ' }, app: mockApp };
      (movieQueries.searchMovies as any).mockResolvedValue([]);

      const handler = getRouteHandler('/search', 'get');
      await handler(mockReq, mockRes, mockNext);

      expect(movieQueries.searchMovies).toHaveBeenCalledWith(db, 'Matrix', 10);
    });
  });
});
