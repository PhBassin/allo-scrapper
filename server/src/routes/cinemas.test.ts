import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockGetAllCinemas = vi.fn();
const mockGetCinemaShowtimes = vi.fn();
const mockAddCinemaViaUrl = vi.fn();
const mockAddCinemaManual = vi.fn();
const mockUpdateCinema = vi.fn();
const mockDeleteCinema = vi.fn();

vi.mock('../services/cinema-service.js', () => {
  return {
    CinemaService: vi.fn().mockImplementation(function() {
      return {
        getAllCinemas: mockGetAllCinemas,
        getCinemaShowtimes: mockGetCinemaShowtimes,
        addCinemaViaUrl: mockAddCinemaViaUrl,
        addCinemaManual: mockAddCinemaManual,
        updateCinema: mockUpdateCinema,
        deleteCinema: mockDeleteCinema,
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

  const { default: cinemasRouter } = await import('./cinemas.js');
  app.use('/api/cinemas', cinemasRouter);
  
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(500).json({ success: false, error: 'Internal Test Error' });
  });

  return app;
}

describe('Routes - Cinemas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('GET /api/cinemas', () => {
    it('should return all cinemas', async () => {
      mockGetAllCinemas.mockResolvedValue([{ id: 'C0153', name: 'Test Cinema' }]);
      const app = await setupApp();
      
      const response = await request(app).get('/api/cinemas');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(mockGetAllCinemas).toHaveBeenCalled();
    });
  });

  describe('POST /api/cinemas', () => {
    it('should handle smart add via URL', async () => {
      const cinemaUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=C0099.html';
      mockAddCinemaViaUrl.mockResolvedValue({ id: 'C0099', name: 'C0099', url: cinemaUrl });
      const app = await setupApp();
      
      const response = await request(app).post('/api/cinemas').send({ url: cinemaUrl });
      
      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('C0099');
      expect(mockAddCinemaViaUrl).toHaveBeenCalledWith(cinemaUrl);
    });

    it('should handle URL validation errors from service', async () => {
      mockAddCinemaViaUrl.mockRejectedValue(new Error('Invalid Allocine URL.'));
      const app = await setupApp();
      
      const response = await request(app).post('/api/cinemas').send({ url: 'https://badurl.com' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Allocine URL');
    });

    it('should handle manual add', async () => {
      mockAddCinemaManual.mockResolvedValue({ id: 'C0099', name: 'Test', url: 'https://...' });
      const app = await setupApp();
      
      const response = await request(app).post('/api/cinemas').send({ id: 'C0099', name: 'Test', url: 'https://...' });
      
      expect(response.status).toBe(201);
      expect(mockAddCinemaManual).toHaveBeenCalledWith('C0099', 'Test', 'https://...');
    });
  });

  describe('PUT /api/cinemas/:id', () => {
    it('should update cinema', async () => {
      mockUpdateCinema.mockResolvedValue({ id: 'C0099', name: 'Updated' });
      const app = await setupApp();
      
      const response = await request(app).put('/api/cinemas/C0099').send({ name: 'Updated' });
      
      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/cinemas/:id', () => {
    it('should delete cinema', async () => {
      mockDeleteCinema.mockResolvedValue(true);
      const app = await setupApp();
      
      const response = await request(app).delete('/api/cinemas/C0099');
      
      expect(response.status).toBe(204);
    });
  });

  describe('GET /api/cinemas/:id', () => {
    it('should get cinema showtimes', async () => {
      mockGetCinemaShowtimes.mockResolvedValue([{ id: 'S1', time: '14:00' }]);
      const app = await setupApp();
      
      const response = await request(app).get('/api/cinemas/C0099');
      
      expect(response.status).toBe(200);
      expect(response.body.data.showtimes).toHaveLength(1);
    });
  });
});
