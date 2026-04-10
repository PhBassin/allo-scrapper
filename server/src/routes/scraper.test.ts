import { errorHandler } from '../middleware/error-handler.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockTriggerScrape = vi.fn();
const mockGetStatus = vi.fn();
const mockSubscribeToProgress = vi.fn();
const mockPublishScheduleChange = vi.fn();

let currentMockUser = { role_name: 'admin', is_system_role: true, permissions: [], id: 1, username: 'admin' };
let failAuth = false;

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

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (failAuth) return res.status(401).json({ error: 'Unauthorized' });
    req.user = currentMockUser;
    next();
  },
}));

// Mock rate limiter to avoid issues in tests
vi.mock('../middleware/rate-limit.js', () => ({
  scraperLimiter: (req: any, res: any, next: any) => next(),
  protectedLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock permission middleware
vi.mock('../middleware/permission.js', () => ({
  requirePermission: () => (req: any, res: any, next: any) => next(),
}));

// Mock Redis client for schedule publishing
vi.mock('../services/redis-client.js', () => ({
  getRedisClient: () => ({
    publishScheduleChange: mockPublishScheduleChange,
  }),
}));

// Mock schedule queries
vi.mock('../db/schedule-queries.js', () => ({
  getAllSchedules: vi.fn().mockResolvedValue([]),
  getScheduleById: vi.fn().mockResolvedValue({ id: 1, name: 'Test', cron_expression: '0 3 * * *', enabled: true }),
  createSchedule: vi.fn().mockResolvedValue({ id: 1, name: 'Test', cron_expression: '0 3 * * *', enabled: true }),
  updateSchedule: vi.fn().mockResolvedValue({ id: 1, name: 'Updated', cron_expression: '0 3 * * *', enabled: true }),
  deleteSchedule: vi.fn().mockResolvedValue(undefined),
  type: {},
}));

// Setup Express app for testing
async function setupApp(mockUser?: any) {
  if (mockUser) {
    currentMockUser = { ...currentMockUser, ...mockUser };
  } else {
    currentMockUser = { role_name: 'admin', is_system_role: true, permissions: [], id: 1, username: 'admin' };
  }

  const { default: scraperRouter } = await import('./scraper.js');

  const app = express();
  app.use(express.json());
  app.set('db', {});
  app.use('/api/scraper', scraperRouter);
  app.use(errorHandler);

  return app;
}

describe('Routes - Scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTriggerScrape.mockResolvedValue({ reportId: 42, queueDepth: 1 });
    mockGetStatus.mockResolvedValue({ isRunning: false, latestReport: null });
    mockPublishScheduleChange.mockResolvedValue(undefined);
    failAuth = false;
  });

  describe('POST /api/scraper/trigger', () => {
    it('should handle request without body (regression test for #488)', async () => {
      const app = await setupApp({ role_name: 'admin', is_system_role: true, permissions: [] });
      
      // This is the bug case - sending request without any body
      // Previously this caused "Cannot destructure property 'cinemaId' of 'req.body' as it is undefined"
      const response = await request(app).post('/api/scraper/trigger');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTriggerScrape).toHaveBeenCalledWith({});
    });

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
    it('should require authentication', async () => {
      failAuth = true;
      const app = await setupApp();
      const response = await request(app).get('/api/scraper/status');

      expect(response.status).toBe(401);
    });

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

  describe('Schedule Pub/Sub', () => {
    it('should publish schedule change after create', async () => {
      const app = await setupApp();
      const response = await request(app)
        .post('/api/scraper/schedules')
        .send({
          name: 'Test Schedule',
          cron_expression: '0 3 * * *',
          enabled: true,
        });

      expect(response.status).toBe(201);
      expect(mockPublishScheduleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          scheduleId: 1,
        })
      );
    });

    it('should publish schedule change after update', async () => {
      const app = await setupApp();
      const response = await request(app)
        .put('/api/scraper/schedules/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(mockPublishScheduleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          scheduleId: 1,
        })
      );
    });

    it('should publish schedule change after delete', async () => {
      const app = await setupApp();
      const response = await request(app).delete('/api/scraper/schedules/1');

      expect(response.status).toBe(204);
      expect(mockPublishScheduleChange).toHaveBeenCalledWith({
        action: 'deleted',
        scheduleId: 1,
      });
    });

    it('should trigger schedule immediately via POST /schedules/:id/trigger', async () => {
      mockTriggerScrape.mockResolvedValue({ reportId: 99, queueDepth: 2 });

      const app = await setupApp();
      const response = await request(app).post('/api/scraper/schedules/1/trigger');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reportId).toBe(99);
      expect(response.body.data.scheduleId).toBe(1);
      expect(mockTriggerScrape).toHaveBeenCalled();
    });
  });
});