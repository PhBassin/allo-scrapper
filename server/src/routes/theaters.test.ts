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
type SetupAppOptions = {
  mountPath?: '/api/theaters' | '/api/org/:slug/theaters';
  injectOrgContext?: boolean;
  authenticatedOrgId?: number;
};

async function setupApp(options: SetupAppOptions = {}) {
  const {
    mountPath = '/api/theaters',
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
          permissions: ['theaters:read', 'theaters:create', 'theaters:update', 'theaters:delete'],
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

  const { default: theatersRouter } = await import('./theaters.js');
  app.use(mountPath, theatersRouter);
  
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

    it('should reject cross-tenant query mismatch in org-scoped route', async () => {
      const app = await setupApp({
        mountPath: '/api/org/:slug/theaters',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app).get('/api/org/acme/theaters?org_id=2');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cross-tenant access denied');
      expect(mockGetAllTheaters).not.toHaveBeenCalled();
      expect(mockGetAllTheaters).toHaveBeenCalledTimes(0);
    });

    it('should allow org-scoped read without query org_id and keep scoped response', async () => {
      mockGetAllTheaters.mockResolvedValue([
        { id: 'A1', name: 'Theater Org A' },
      ]);
      const app = await setupApp({
        mountPath: '/api/org/:slug/theaters',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app).get('/api/org/acme/theaters');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([{ id: 'A1', name: 'Theater Org A' }]);
      expect(response.body.data).not.toContainEqual(expect.objectContaining({ id: 'B1' }));
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

    it('should allow org-scoped create and sanitize forged org_id from body', async () => {
      mockAddTheaterManual.mockResolvedValue({ id: 'C0100', name: 'Tenant Theater', url: 'https://tenant.example' });
      const app = await setupApp({
        mountPath: '/api/org/:slug/theaters',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app)
        .post('/api/org/acme/theaters')
        .send({
          id: 'C0100',
          name: 'Tenant Theater',
          url: 'https://tenant.example',
          org_id: 999,
        });

      expect(response.status).toBe(201);
      expect(mockAddTheaterManual).toHaveBeenCalledWith('C0100', 'Tenant Theater', 'https://tenant.example');
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

    it('should reject cross-tenant org-scoped theater schedule access', async () => {
      const app = await setupApp({
        mountPath: '/api/org/:slug/theaters',
        injectOrgContext: true,
        authenticatedOrgId: 1,
      });

      const response = await request(app).get('/api/org/acme/theaters/C0099?org_id=2');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cross-tenant access denied');
      expect(mockGetTheaterShowtimes).not.toHaveBeenCalled();
      expect(mockGetTheaterShowtimes).toHaveBeenCalledTimes(0);
    });
  });
});
