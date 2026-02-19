import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as queries from '../db/queries.js';
import router from './cinemas.js';

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
}));

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

describe('Routes - Cinemas', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('POST /', () => {
    it('should create a new cinema and return 201', async () => {
      mockReq = {
        body: { id: 'C0099', name: 'New Cinema', url: 'https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html' }
      };
      const created = { id: 'C0099', name: 'New Cinema', url: 'https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html' };
      (queries.addCinema as any).mockResolvedValue(created);

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.post)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(queries.addCinema).toHaveBeenCalledWith(expect.anything(), { id: 'C0099', name: 'New Cinema', url: 'https://www.example-cinema-site.com/seance/salle_gen_csalle=C0099.html' });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: created }));
    });

    it('should return 400 when id is missing', async () => {
      mockReq = { body: { name: 'Missing ID', url: 'https://example.com' } };

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.post)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 400 when name is missing', async () => {
      mockReq = { body: { id: 'C0099', url: 'https://example.com' } };

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.post)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when url is missing', async () => {
      mockReq = { body: { id: 'C0099', name: 'New Cinema' } };

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.post)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 409 on duplicate cinema id', async () => {
      mockReq = { body: { id: 'W7504', name: 'Duplicate', url: 'https://example.com' } };
      (queries.addCinema as any).mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.post)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next(error) on unexpected error', async () => {
      mockReq = { body: { id: 'C0099', name: 'New Cinema', url: 'https://example.com' } };
      const error = new Error('Unexpected DB error');
      (queries.addCinema as any).mockRejectedValue(error);

      const handler = router.stack.find(s => s.route?.path === '/' && s.route?.methods.post)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /:id', () => {
    it('should update a cinema and return the updated record', async () => {
      mockReq = { params: { id: 'W7504' }, body: { name: 'Updated Name', url: 'https://new-url.com' } };
      const updated = { id: 'W7504', name: 'Updated Name', url: 'https://new-url.com' };
      (queries.updateCinemaConfig as any).mockResolvedValue(updated);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.put)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(queries.updateCinemaConfig).toHaveBeenCalledWith(expect.anything(), 'W7504', { name: 'Updated Name', url: 'https://new-url.com' });
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: updated }));
    });

    it('should return 400 when body is empty', async () => {
      mockReq = { params: { id: 'W7504' }, body: {} };

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.put)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when cinema not found', async () => {
      mockReq = { params: { id: 'UNKNOWN' }, body: { name: 'X' } };
      (queries.updateCinemaConfig as any).mockResolvedValue(undefined);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.put)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next(error) on unexpected error', async () => {
      mockReq = { params: { id: 'W7504' }, body: { name: 'X' } };
      const error = new Error('DB Error');
      (queries.updateCinemaConfig as any).mockRejectedValue(error);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.put)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete a cinema and return 204', async () => {
      mockReq = { params: { id: 'W7504' } };
      (queries.deleteCinema as any).mockResolvedValue(true);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.delete)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(queries.deleteCinema).toHaveBeenCalledWith(expect.anything(), 'W7504');
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalledWith();
    });

    it('should return 404 when cinema not found', async () => {
      mockReq = { params: { id: 'UNKNOWN' } };
      (queries.deleteCinema as any).mockResolvedValue(false);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.delete)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next(error) on unexpected error', async () => {
      mockReq = { params: { id: 'W7504' } };
      const error = new Error('DB Error');
      (queries.deleteCinema as any).mockRejectedValue(error);

      const handler = router.stack.find(s => s.route?.path === '/:id' && s.route?.methods.delete)?.route.stack[0].handle;
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
