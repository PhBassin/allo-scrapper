import { errorHandler } from '../middleware/error-handler.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockGetAllTheaters = vi.fn();
const mockGetTheaterShowtimes = vi.fn();
const mockAddTheaterViaUrl = vi.fn();
const mockAddTheaterManual = vi.fn();
const mockUpdateTheater = vi.fn();
const mockDeleteTheater = vi.fn();

vi.mock('../services/theater-service.js', () => {
  return {
    TheaterService: vi.fn().mockImplementation(function() {
      return {
        getAllTheaters: mockGetAllTheaters,
        getTheaterShowtimes: mockGetTheaterShowtimes,
        addTheaterViaUrl: mockAddTheaterViaUrl,
        addTheaterManual: mockAddTheaterManual,
        updateTheater: mockUpdateTheater,
        deleteTheater: mockDeleteTheater,
      };
    }),
  };
});

vi.mock('../utils/date.js', () => ({
  getWeekStart: vi.fn().mockReturnValue('2026-02-18')
}));

// Setup Express app for testing
async function setupApp() {
  vi.doMock('../middleware/auth.js', () => ({
    requireAuth: (req: any, res: any, next: any) => next()
  }));

  vi.doMock('../middleware/permission.js', () => ({
    requirePermission: () => (req: any, res: any, next: any) => next()
  }));
  
  vi.doMock('../middleware/rate-limit.js', () => ({
    publicLimiter: (req: any, res: any, next: any) => next(),
    protectedLimiter: (req: any, res: any, next: any) => next(),
  }));

  const app = express();
  app.use(express.json());
  app.set('db', {});

  const { default: theatersRouter } = await import('./theaters.js');
  app.use('/api/theaters', theatersRouter);
  
  app.use(errorHandler);

  return app;
}

describe('Routes - Theaters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('GET /api/theaters', () => {
    it('should return all theaters', async () => {
      mockGetAllTheaters.mockResolvedValue([{ id: 'C0153', name: 'Test Theater' }]);
      const app = await setupApp();
      
      const response = await request(app).get('/api/theaters');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(mockGetAllTheaters).toHaveBeenCalled();
    });
  });

  describe('POST /api/theaters', () => {
    it('should handle smart add via URL', async () => {
      const theaterUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html';
      mockAddTheaterViaUrl.mockResolvedValue({ id: 'C0099', name: 'C0099', url: theaterUrl });
      const app = await setupApp();
      
      const response = await request(app).post('/api/theaters').send({ url: theaterUrl });
      
      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('C0099');
      expect(mockAddTheaterViaUrl).toHaveBeenCalledWith(theaterUrl);
    });

    it('should handle URL validation errors from service', async () => {
      mockAddTheaterViaUrl.mockRejectedValue(new Error('Invalid Allocine URL.'));
      const app = await setupApp();
      
      const response = await request(app).post('/api/theaters').send({ url: 'https://badurl.com' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Allocine URL');
    });

    it('should handle manual add', async () => {
      mockAddTheaterManual.mockResolvedValue({ id: 'C0099', name: 'Test', url: 'https://...' });
      const app = await setupApp();
      
      const response = await request(app).post('/api/theaters').send({ id: 'C0099', name: 'Test', url: 'https://...' });
      
      expect(response.status).toBe(201);
      expect(mockAddTheaterManual).toHaveBeenCalledWith('C0099', 'Test', 'https://...');
    });
  });

  describe('PUT /api/theaters/:id', () => {
    it('should update theater', async () => {
      mockUpdateTheater.mockResolvedValue({ id: 'C0099', name: 'Updated' });
      const app = await setupApp();
      
      const response = await request(app).put('/api/theaters/C0099').send({ name: 'Updated' });
      
      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/theaters/:id', () => {
    it('should delete theater', async () => {
      mockDeleteTheater.mockResolvedValue(true);
      const app = await setupApp();
      
      const response = await request(app).delete('/api/theaters/C0099');
      
      expect(response.status).toBe(204);
    });
  });

  describe('GET /api/theaters/:id', () => {
    it('should get theater showtimes', async () => {
      mockGetTheaterShowtimes.mockResolvedValue([{ id: 'S1', time: '14:00' }]);
      const app = await setupApp();
      
      const response = await request(app).get('/api/theaters/C0099');
      
      expect(response.status).toBe(200);
      expect(response.body.data.showtimes).toHaveLength(1);
    });
  });
});
