import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as queries from '../db/queries.js';
import router from './cinemas.js';
import { db } from '../db/client.js';

// Mock the dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn()
  }
}));

vi.mock('../db/queries.js', () => ({
  getCinemas: vi.fn(),
  getShowtimesByCinemaAndWeek: vi.fn(),
  addCinema: vi.fn(),
  updateCinemaConfig: vi.fn(),
  deleteCinema: vi.fn(),
  createScrapeReport: vi.fn().mockResolvedValue(42),
}));

vi.mock('../services/redis-client.js', () => ({
  getRedisClient: vi.fn().mockReturnValue({
    publishAddCinemaJob: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
}));

vi.mock('../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) => (req: any, res: any, next: any) => next(),
}));

// Helper to get the actual route handler (skips middleware like rate limiters)
function getRouteHandler(path: string, method: 'get' | 'post' | 'put' | 'delete') {
  const route = router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route;
  // Get the last handler in the stack (actual route handler, after middleware)
  return route?.stack[route.stack.length - 1]?.handle;
}

describe('Routes - Cinemas', () => {
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
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('POST / (URL-only smart add — delegates to Redis)', () => {
    it('should accept URL-only body, insert cinema, publish add_cinema job, return 201', async () => {
      const cinemaUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html';
      mockReq = { body: { url: cinemaUrl }, app: mockApp };

      const created = { id: 'C0099', name: 'C0099', url: cinemaUrl };
      (queries.addCinema as any).mockResolvedValue(created);

      const { getRedisClient } = await import('../services/redis-client.js');
      const mockPublishAddCinemaJob = vi.fn().mockResolvedValue(1);
      (getRedisClient as any).mockReturnValue({ publishAddCinemaJob: mockPublishAddCinemaJob });

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(queries.addCinema).toHaveBeenCalled();
      expect(mockPublishAddCinemaJob).toHaveBeenCalledWith(expect.any(Number), cinemaUrl);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 when URL is invalid', async () => {
      mockReq = { body: { url: 'https://evil.com/fake' }, app: mockApp };

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('Invalid Allocine URL') })
      );
    });

    it('should return 400 when URL is too long', async () => {
      mockReq = { body: { url: 'https://www.allocine.fr/' + 'a'.repeat(2048) }, app: mockApp };

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /', () => {
    it('should create a new cinema and return 201', async () => {
      mockReq = {
        body: { id: 'C0099', name: 'New Cinema', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html' },
        app: mockApp
      };
      const created = { id: 'C0099', name: 'New Cinema', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html' };
      (queries.addCinema as any).mockResolvedValue(created);

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(queries.addCinema).toHaveBeenCalledWith(expect.anything(), { id: 'C0099', name: 'New Cinema', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html' });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: created }));
    });

    it('should return 400 when id is missing', async () => {
      mockReq = { body: { name: 'Missing ID', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html' }, app: mockApp };

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 400 when name is missing', async () => {
      mockReq = { body: { id: 'C0099', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html' }, app: mockApp };

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when url is missing', async () => {
      mockReq = { body: { id: 'C0099', name: 'New Cinema' }, app: mockApp };

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when url is invalid', async () => {
      mockReq = { body: { id: 'C0099', name: 'New Cinema', url: 'https://example.com' }, app: mockApp };

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.stringContaining('Invalid Allocine URL') }));
    });

    it('should return 409 on duplicate cinema id', async () => {
      mockReq = { body: { id: 'W7504', name: 'Duplicate', url: 'https://www.allocine.fr/seance/salle_affich-salle=W7504.html' }, app: mockApp };
      (queries.addCinema as any).mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next(error) on unexpected error', async () => {
      mockReq = { body: { id: 'C0099', name: 'New Cinema', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html' }, app: mockApp };
      const error = new Error('Unexpected DB error');
      (queries.addCinema as any).mockRejectedValue(error);

      const handler = getRouteHandler('/', 'post');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /:id', () => {
    it('should update a cinema and return the updated record', async () => {
      mockReq = { params: { id: 'W7504' }, body: { name: 'Updated Name', url: 'https://www.allocine.fr/new-url.html' }, app: mockApp };
      const updated = { id: 'W7504', name: 'Updated Name', url: 'https://www.allocine.fr/new-url.html' };
      (queries.updateCinemaConfig as any).mockResolvedValue(updated);

      const handler = getRouteHandler('/:id', 'put');
      await handler(mockReq, mockRes, mockNext);

      expect(queries.updateCinemaConfig).toHaveBeenCalledWith(expect.anything(), 'W7504', { name: 'Updated Name', url: 'https://www.allocine.fr/new-url.html' });
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: updated }));
    });

    it('should return 400 when body is empty', async () => {
      mockReq = { params: { id: 'W7504' }, body: {}, app: mockApp };

      const handler = getRouteHandler('/:id', 'put');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when url is invalid', async () => {
      mockReq = { params: { id: 'W7504' }, body: { url: 'https://example.com' }, app: mockApp };

      const handler = getRouteHandler('/:id', 'put');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.stringContaining('Invalid Allocine URL') }));
    });

    it('should return 404 when cinema not found', async () => {
      mockReq = { params: { id: 'UNKNOWN' }, body: { name: 'X' }, app: mockApp };
      (queries.updateCinemaConfig as any).mockResolvedValue(undefined);

      const handler = getRouteHandler('/:id', 'put');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next(error) on unexpected error', async () => {
      mockReq = { params: { id: 'W7504' }, body: { name: 'X' }, app: mockApp };
      const error = new Error('DB Error');
      (queries.updateCinemaConfig as any).mockRejectedValue(error);

      const handler = getRouteHandler('/:id', 'put');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete a cinema and return 204', async () => {
      mockReq = { params: { id: 'W7504' }, app: mockApp };
      (queries.deleteCinema as any).mockResolvedValue(true);

      const handler = getRouteHandler('/:id', 'delete');
      await handler(mockReq, mockRes, mockNext);

      expect(queries.deleteCinema).toHaveBeenCalledWith(expect.anything(), 'W7504');
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalledWith();
    });

    it('should return 404 when cinema not found', async () => {
      mockReq = { params: { id: 'UNKNOWN' }, app: mockApp };
      (queries.deleteCinema as any).mockResolvedValue(false);

      const handler = getRouteHandler('/:id', 'delete');
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next(error) on unexpected error', async () => {
      mockReq = { params: { id: 'W7504' }, app: mockApp };
      const error = new Error('DB Error');
      (queries.deleteCinema as any).mockRejectedValue(error);

      const handler = getRouteHandler('/:id', 'delete');
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
