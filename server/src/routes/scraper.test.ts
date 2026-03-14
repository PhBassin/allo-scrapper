import { errorHandler } from '../middleware/error-handler.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockTriggerScrape = vi.fn();
const mockGetStatus = vi.fn();
const mockSubscribeToProgress = vi.fn();

vi.mock('../services/scraper-service.js', () => {
  return {
    ScraperService: vi.fn().mockImplementation(function() {
      return {
        triggerScrape: mockTriggerScrape,
        getStatus: mockGetStatus,
        subscribeToProgress: mockSubscribeToProgress,
      };
    }),
  };
});

vi.mock('../db/client.js', () => ({
  db: { query: vi.fn() }
}));

// Mock rate limiter to avoid issues in tests
vi.mock('../middleware/rate-limit.js', () => ({
  scraperLimiter: (req: any, res: any, next: any) => next()
}));

// Setup Express app for testing
async function setupApp(mockUser: any = { role_name: 'admin', is_system_role: true, permissions: [] }) {
  vi.doMock('../middleware/auth.js', () => ({
    requireAuth: (req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    }
  }));

  const app = express();
  app.use(express.json());
  
  // Set mock db
  app.set('db', {});

  // Dynamically import router after mocks are set
  const { default: scraperRouter } = await import('./scraper.js');
  app.use('/api/scraper', scraperRouter);
  
  // Global error handler
  app.use(errorHandler);
  
  return app;
}

describe('Routes - Scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Important for dynamic imports
    mockTriggerScrape.mockResolvedValue({ reportId: 42, queueDepth: 1 });
    mockGetStatus.mockResolvedValue({ isRunning: false, latestReport: null });
  });

  describe('POST /api/scraper/trigger', () => {
    it('should return 403 if user lacks permissions', async () => {
      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: [] });
      
      const response = await request(app).post('/api/scraper/trigger').send({});
      
      expect(response.status).toBe(403);
      expect(mockTriggerScrape).not.toHaveBeenCalled();
    });

    it('should allow admin to trigger scrape', async () => {
      const app = await setupApp({ role_name: 'admin', is_system_role: true, permissions: [] });
      
      const response = await request(app).post('/api/scraper/trigger').send({});
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reportId).toBe(42);
      expect(mockTriggerScrape).toHaveBeenCalledWith({});
    });

    it('should pass cinemaId and filmId to the service', async () => {
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({
        cinemaId: 'C0153',
        filmId: 12345
      });
      
      expect(response.status).toBe(200);
      expect(mockTriggerScrape).toHaveBeenCalledWith({ cinemaId: 'C0153', filmId: 12345 });
    });

    it('should handle service errors gracefully (e.g., Cinema not found)', async () => {
      mockTriggerScrape.mockRejectedValue(new Error('Cinema not found: X'));
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({ cinemaId: 'X' });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Cinema not found');
    });

    it('should handle generic service errors with 500', async () => {
      mockTriggerScrape.mockRejectedValue(new Error('Redis connection failed'));
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({});
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Redis connection failed');
    });
  });

  describe('GET /api/scraper/status', () => {
    it('should return the status from the service', async () => {
      mockGetStatus.mockResolvedValue({ isRunning: true, latestReport: { id: 99 } });
      const app = await setupApp();

      const response = await request(app).get('/api/scraper/status');

      expect(response.status).toBe(200);
      expect(response.body.data.isRunning).toBe(true);
      expect(response.body.data.latestReport.id).toBe(99);
      expect(mockGetStatus).toHaveBeenCalled();
    });
  });
});
