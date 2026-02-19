import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/client.js';
import * as queries from '../db/queries.js';
import * as dateUtils from '../utils/date.js';
import router from './films.js';

// Mock the dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/queries.js', () => ({
  getWeeklyFilms: vi.fn(),
  getFilm: vi.fn(),
  getShowtimesByFilmAndWeek: vi.fn(),
  getWeeklyShowtimes: vi.fn()
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

describe('Routes - Films', () => {
  let mockRes: any;
  let mockReq: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
  });

  describe('GET /', () => {
    it('should return weekly films with showtimes', async () => {
      mockReq = {};
      const mockFilms = [{ id: 1, title: 'Film 1' }];
      const mockShowtimes = [
        { id: 's1', film_id: 1, cinema_id: 'C1', cinema: { id: 'C1', name: 'Cinema 1' } }
      ];

      (queries.getWeeklyFilms as any).mockResolvedValue(mockFilms);
      (queries.getWeeklyShowtimes as any).mockResolvedValue(mockShowtimes);

      // We need to call the handler. Express router makes it hard to call directly.
      // In a real test we'd use supertest. Here we'll find the handler.
      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.get)?.route.stack[0].handle;
      
      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.films[0].cinemas).toHaveLength(1);
      expect(response.data.films[0].cinemas[0].id).toBe('C1');
    });

    it('should handle errors', async () => {
      mockReq = {};
      (queries.getWeeklyFilms as any).mockRejectedValue(new Error('DB Error'));

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.get)?.route.stack[0].handle;
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('GET /:id', () => {
    it('should return film by ID with showtimes', async () => {
      mockReq = { params: { id: '1' } };
      const mockFilm = { id: 1, title: 'Film 1' };
      const mockShowtimes = [
        { id: 's1', film_id: 1, cinema_id: 'C1', cinema: { id: 'C1', name: 'Cinema 1' } }
      ];

      (queries.getFilm as any).mockResolvedValue(mockFilm);
      (queries.getShowtimesByFilmAndWeek as any).mockResolvedValue(mockShowtimes);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.get)?.route.stack[0].handle;
      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.cinemas).toHaveLength(1);
    });

    it('should return 400 for invalid ID', async () => {
      mockReq = { params: { id: 'abc' } };
      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.get)?.route.stack[0].handle;
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent film', async () => {
      mockReq = { params: { id: '99' } };
      (queries.getFilm as any).mockResolvedValue(null);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.get)?.route.stack[0].handle;
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
