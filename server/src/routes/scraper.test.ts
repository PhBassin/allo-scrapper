import { errorHandler } from '../middleware/error-handler.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TheaterNotFoundError } from '../utils/errors.js';
import { progressTracker } from '../services/progress-tracker.js';

const mockTriggerScrape = vi.fn();
const mockTriggerResume = vi.fn();
const mockGetScrapeReport = vi.fn();
const mockGetPendingScrapeAttempts = vi.fn();
const mockGetStatus = vi.fn();
const mockAttachProgressStream = vi.fn();
const mockPublishScheduleChange = vi.fn();

let currentMockUser = { role_name: 'admin', is_system_role: true, permissions: [], id: 1, username: 'admin' };
let shouldRejectAuth = false;

vi.mock('../services/scraper-service.js', () => {
  return {
    ScraperService: vi.fn().mockImplementation(function() {
      return {
        triggerScrape: mockTriggerScrape,
        triggerResume: mockTriggerResume,
        getStatus: mockGetStatus,
      };
    }),
  };
});

vi.mock('../db/report-queries.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db/report-queries.js')>()),
  getScrapeReport: (...args: unknown[]) => mockGetScrapeReport(...args),
}));

vi.mock('../db/scrape-attempt-queries.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db/scrape-attempt-queries.js')>()),
  getPendingScrapeAttempts: (...args: unknown[]) => mockGetPendingScrapeAttempts(...args),
}));

vi.mock('../services/sse-bridge.js', () => ({
  attachProgressStream: mockAttachProgressStream,
}));

vi.mock('../db/internal/client.js', () => ({
  db: { query: vi.fn() }
}));

vi.mock('../middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requireAuth: (req: any, res: any, next: any) => {
      if (shouldRejectAuth) {
        return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
      }
      req.user = currentMockUser;
      next();
    },
  };
});

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
  const { default: scraperSchedulesRouter } = await import('./scraper-schedules.js');

  const app = express();
  app.use(express.json());
  app.set('db', {});
  app.use('/api/scraper', scraperRouter);
  app.use('/api/scraper', scraperSchedulesRouter);
  app.use(errorHandler);

  return app;
}

describe('Routes - Scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTriggerScrape.mockResolvedValue({ reportId: 42, queueDepth: 1 });
    mockGetStatus.mockResolvedValue({ isRunning: false, latestReport: null });
    mockPublishScheduleChange.mockResolvedValue(undefined);
  });

  describe('POST /api/scraper/trigger', () => {
    it('should handle request without body (regression test for #488)', async () => {
      const app = await setupApp({ role_name: 'admin', is_system_role: true, permissions: [] });
      
      // This is the bug case - sending request without any body
      // Previously this caused "Cannot destructure property 'theaterId' of 'req.body' as it is undefined"
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

    it('should pass theaterId and movieId to the service', async () => {
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({
        theaterId: 'C0153',
        movieId: 12345
      });
      
      expect(response.status).toBe(200);
      expect(mockTriggerScrape).toHaveBeenCalledWith({ theaterId: 'C0153', movieId: 12345 });
    });

    it('should handle service errors gracefully (e.g., Theater not found)', async () => {
      mockTriggerScrape.mockRejectedValue(new TheaterNotFoundError('X'));
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({ theaterId: 'X' });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Theater not found');
    });

    it('should handle generic service errors with 500', async () => {
      mockTriggerScrape.mockRejectedValue(new Error('Redis connection failed'));
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({});
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Redis connection failed');
    });
  });

  describe('POST /api/scraper/resume/:reportId', () => {
    // A report shaped like #20: some successes, a 429 on one theater, then
    // the cascade of not_attempted pairs. getPendingScrapeAttempts returns
    // only its resumable pairs.
    const pending = [
      { id: 4, report_id: 20, theater_id: 'C0074', date: '2026-03-10', status: 'rate_limited' },
      { id: 5, report_id: 20, theater_id: 'C0074', date: '2026-03-11', status: 'not_attempted' },
      { id: 6, report_id: 20, theater_id: 'C0099', date: '2026-03-10', status: 'not_attempted' },
    ];

    beforeEach(() => {
      mockGetScrapeReport.mockResolvedValue({ id: 20, status: 'partial_success', trigger_type: 'cron' });
      mockGetPendingScrapeAttempts.mockResolvedValue(pending);
      mockTriggerResume.mockResolvedValue({ reportId: 21, queueDepth: 1 });
    });

    it('resumes a partial_success report with only its pending pairs', async () => {
      const app = await setupApp();

      const response = await request(app).post('/api/scraper/resume/20');

      expect(response.status).toBe(200);
      expect(mockGetPendingScrapeAttempts).toHaveBeenCalledWith(expect.anything(), 20);
      expect(mockTriggerResume).toHaveBeenCalledWith(20, pending);
      expect(response.body.data).toMatchObject({ reportId: 21, parentReportId: 20, pendingAttempts: 3 });
    });

    it('refuses a report without pending pairs', async () => {
      mockGetPendingScrapeAttempts.mockResolvedValue([]);
      const app = await setupApp();

      const response = await request(app).post('/api/scraper/resume/20');

      expect(response.status).toBe(400);
      expect(mockTriggerResume).not.toHaveBeenCalled();
    });

    it('returns 403 without scraper:trigger', async () => {
      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: [] });

      const response = await request(app).post('/api/scraper/resume/20');

      expect(response.status).toBe(403);
      expect(mockTriggerResume).not.toHaveBeenCalled();
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

    it('should return 401 for unauthenticated requests', async () => {
      shouldRejectAuth = true;
      try {
        const app = await setupApp();
        const response = await request(app).get('/api/scraper/status');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Authentication required. No token provided.');
        expect(mockGetStatus).not.toHaveBeenCalled();
      } finally {
        shouldRejectAuth = false;
      }
    });
  });

  describe('GET /api/scraper/progress', () => {
    it('wires the response to the SSE bridge with the progress tracker', async () => {
      // The real bridge keeps the stream open; end res so supertest completes.
      mockAttachProgressStream.mockImplementation((res: any) => {
        res.end();
        return vi.fn();
      });

      const app = await setupApp();
      await request(app).get('/api/scraper/progress');

      expect(mockAttachProgressStream).toHaveBeenCalledTimes(1);
      const [resArg, sinkArg, onCloseArg] = mockAttachProgressStream.mock.calls[0];
      expect(resArg).toBeDefined();
      expect(sinkArg).toBe(progressTracker);
      expect(typeof onCloseArg).toBe('function');
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
