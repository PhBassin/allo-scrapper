import { errorHandler } from '../middleware/error-handler.js';
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
type SetupAppOptions = {
  mountPath?: '/api/cinemas' | '/api/org/:slug/cinemas';
  injectOrgContext?: boolean;
  authenticatedOrgId?: number;
};

async function setupApp(options: SetupAppOptions = {}) {
  const {
    mountPath = '/api/cinemas',
    injectOrgContext = false,
    authenticatedOrgId,
  } = options;

  vi.doMock('../middleware/auth.js', () => ({
    requireAuth: (req: any, res: any, next: any) => {
      if (typeof authenticatedOrgId === 'number') {
        req.user = {
          id: 100,
          username: 'tester',
          role_name: 'admin',
          is_system_role: true,
          permissions: ['cinemas:read', 'cinemas:create', 'cinemas:update', 'cinemas:delete'],
          org_id: authenticatedOrgId,
          org_slug: 'acme',
        };
      }
      next();
    }
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

  if (injectOrgContext) {
    app.use((req, _res, next) => {
      (req as unknown as { org?: { id: number; slug: string } }).org = { id: 1, slug: 'acme' };
      next();
    });
  }

  const { default: cinemasRouter } = await import('./cinemas.js');
  app.use(mountPath, cinemasRouter);
  
  app.use(errorHandler);

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

    it('should reject cross-tenant query mismatch in org-scoped route', async () => {
      const app = await setupApp({
        mountPath: '/api/org/:slug/cinemas',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app).get('/api/org/acme/cinemas?org_id=2');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cross-tenant access denied');
      expect(mockGetAllCinemas).not.toHaveBeenCalled();
    });

    it('should allow org-scoped read without query org_id and keep scoped response', async () => {
      mockGetAllCinemas.mockResolvedValue([
        { id: 'A1', name: 'Cinema Org A' },
      ]);
      const app = await setupApp({
        mountPath: '/api/org/:slug/cinemas',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app).get('/api/org/acme/cinemas');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([{ id: 'A1', name: 'Cinema Org A' }]);
      expect(response.body.data).not.toContainEqual(expect.objectContaining({ id: 'B1' }));
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

    it('should allow org-scoped create and sanitize forged org_id from body', async () => {
      mockAddCinemaManual.mockResolvedValue({ id: 'C0100', name: 'Tenant Cinema', url: 'https://tenant.example' });
      const app = await setupApp({
        mountPath: '/api/org/:slug/cinemas',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app)
        .post('/api/org/acme/cinemas')
        .send({
          id: 'C0100',
          name: 'Tenant Cinema',
          url: 'https://tenant.example',
          org_id: 999,
        });

      expect(response.status).toBe(201);
      expect(mockAddCinemaManual).toHaveBeenCalledWith('C0100', 'Tenant Cinema', 'https://tenant.example');
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

    it('should reject cross-tenant org-scoped cinema schedule access', async () => {
      const app = await setupApp({
        mountPath: '/api/org/:slug/cinemas',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app).get('/api/org/acme/cinemas/C0099?org_id=2');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cross-tenant access denied');
      expect(mockGetCinemaShowtimes).not.toHaveBeenCalled();
    });
  });
});
