import { errorHandler } from '../middleware/error-handler.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockTriggerScrape = vi.fn();
const mockTriggerResume = vi.fn();
const mockGetStatus = vi.fn();
const mockSubscribeToProgress = vi.fn();
const mockPublishScheduleChange = vi.fn();
const mockGetScrapeReport = vi.fn();
const mockGetPendingScrapeAttempts = vi.fn();
const mockLoggerInfo = vi.fn();
const mockListDlqJobs = vi.fn();
const mockRetryDlqJob = vi.fn();
const mockGetDlqJob = vi.fn();

function mountAdminScraperDlqAlias(app: express.Express, scraperRouter: express.Router) {
  const adminAliasRouter = express.Router();
  const allowedPathPattern = /^\/dlq(?:\/[^/]+(?:\/retry)?)?\/?$/;

  adminAliasRouter.use((req, res, next) => {
    if (!allowedPathPattern.test(req.path)) {
      return next();
    }

    return scraperRouter(req, res, next);
  });

  app.use('/api/admin/scraper', adminAliasRouter);
}

let currentMockUser = { role_name: 'admin', is_system_role: true, permissions: [], id: 1, username: 'admin' };
let failAuth = false;

vi.mock('../services/scraper-service.js', () => {
  return {
    ScraperService: vi.fn().mockImplementation(function() {
      return {
        triggerScrape: mockTriggerScrape,
        triggerResume: mockTriggerResume,
        getStatus: mockGetStatus,
        subscribeToProgress: mockSubscribeToProgress,
      };
    }),
  };
});

vi.mock('../db/client.js', () => ({
  db: { query: vi.fn() }
}));

vi.mock('../db/report-queries.js', () => ({
  getScrapeReport: (...args: unknown[]) => mockGetScrapeReport(...args),
}));

vi.mock('../db/scrape-attempt-queries.js', () => ({
  getPendingScrapeAttempts: (...args: unknown[]) => mockGetPendingScrapeAttempts(...args),
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
    listDlqJobs: mockListDlqJobs,
    retryDlqJob: mockRetryDlqJob,
    getDlqJob: mockGetDlqJob,
  }),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
    currentMockUser = { role_name: 'admin', is_system_role: true, permissions: [], id: 1, username: 'admin', ...mockUser };
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
    mockTriggerResume.mockResolvedValue({ reportId: 43, queueDepth: 1 });
    mockGetStatus.mockResolvedValue({ isRunning: false, latestReport: null });
    mockPublishScheduleChange.mockResolvedValue(undefined);
    mockListDlqJobs.mockResolvedValue({ jobs: [], total: 0, page: 1, pageSize: 50 });
    mockRetryDlqJob.mockResolvedValue(null);
    mockGetScrapeReport.mockResolvedValue({ id: 123, status: 'failed' });
    mockGetPendingScrapeAttempts.mockResolvedValue([
      { cinema_id: 'C0042', date: '2026-03-26' },
    ]);
    mockLoggerInfo.mockReset();
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
      expect(mockTriggerScrape).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          endpoint: '/api/scraper/trigger',
          method: 'POST',
          user: expect.objectContaining({ id: 1 }),
        })
      );
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
      expect(mockTriggerScrape).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          endpoint: '/api/scraper/trigger',
          method: 'POST',
          user: expect.objectContaining({ id: 1 }),
        })
      );
    });

    it('should pass cinemaId and filmId to the service', async () => {
      const app = await setupApp();
      
      const response = await request(app).post('/api/scraper/trigger').send({
        cinemaId: 'C0153',
        filmId: 12345
      });
      
      expect(response.status).toBe(200);
      expect(mockTriggerScrape).toHaveBeenCalledWith(
        { cinemaId: 'C0153', filmId: 12345 },
        expect.objectContaining({
          endpoint: '/api/scraper/trigger',
          method: 'POST',
          user: expect.objectContaining({ id: 1 }),
        })
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Scraper trigger requested',
        expect.objectContaining({
          org_id: undefined,
          user_id: 1,
          endpoint: '/api/scraper/trigger',
          method: 'POST',
          cinema_id: 'C0153',
          film_id: 12345,
        })
      );
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
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Scraper status requested',
        expect.objectContaining({
          org_id: undefined,
          user_id: 1,
          endpoint: '/api/scraper/status',
          method: 'GET',
        })
      );
    });
  });

  describe('GET /api/scraper/progress', () => {
    it('should require authentication', async () => {
      failAuth = true;
      const app = await setupApp();

      const response = await request(app).get('/api/scraper/progress');

      expect(response.status).toBe(401);
      expect(mockSubscribeToProgress).not.toHaveBeenCalled();
    });

    it('should subscribe with authenticated observability context', async () => {
      mockSubscribeToProgress.mockImplementation((res, _onClose, _context) => {
        res.status(200).end();
        return () => {};
      });
      const app = await setupApp({ org_id: 42, org_slug: 'acme' });

      const response = await request(app).get('/api/scraper/progress');

      expect(response.status).toBe(200);
      expect(mockSubscribeToProgress).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Function),
        expect.objectContaining({
          endpoint: '/api/scraper/progress',
          method: 'GET',
          user: expect.objectContaining({
            id: 1,
            org_id: 42,
            org_slug: 'acme',
          }),
        })
      );
    });

    it('should run the SSE cleanup callback when the request closes', async () => {
      const cleanup = vi.fn();
      mockSubscribeToProgress.mockImplementation((res) => {
        res.status(200).end();
        return cleanup;
      });

      const app = await setupApp({ org_id: 42, org_slug: 'acme' });

      const response = await request(app).get('/api/scraper/progress');

      expect(response.status).toBe(200);
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('GET /api/scraper/dlq', () => {
    it('should return paginated DLQ jobs newest first', async () => {
      mockListDlqJobs.mockResolvedValue({
        jobs: [
          { job_id: 'job-2', timestamp: '2026-04-21T19:00:00.000Z' },
          { job_id: 'job-1', timestamp: '2026-04-21T18:00:00.000Z' },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      });

      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'] });
      const response = await request(app).get('/api/scraper/dlq?page=1&pageSize=99');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toHaveLength(2);
      expect(response.body.data.jobs[0].job_id).toBe('job-2');
      expect(mockListDlqJobs).toHaveBeenCalledWith(50, 1, undefined);
    });

    it('should return 403 when user lacks scraper trigger permission', async () => {
      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: [] });
      const response = await request(app).get('/api/scraper/dlq');

      expect(response.status).toBe(403);
      expect(mockListDlqJobs).not.toHaveBeenCalled();
    });

    it('should scope DLQ listing to the caller org for non-system users', async () => {
      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'], org_id: 7 });
      const response = await request(app).get('/api/scraper/dlq');

      expect(response.status).toBe(200);
      expect(mockListDlqJobs).toHaveBeenCalledWith(50, 1, 7);
    });
  });

  describe('GET /api/scraper/dlq/:jobId', () => {
    it('should return a single DLQ job entry when found', async () => {
      mockGetDlqJob.mockResolvedValue({
        job_id: 'report-1',
        retry_count: 2,
        failure_reason: 'timeout',
        timestamp: '2026-04-21T18:00:00.000Z',
        cinema_id: 'c1',
        org_id: '7',
        job: { type: 'scrape', triggerType: 'manual', reportId: 5 },
      });

      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'], org_id: 7 });
      const response = await request(app).get('/api/scraper/dlq/report-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe('report-1');
      expect(mockGetDlqJob).toHaveBeenCalledWith('report-1', 7);
    });

    it('should return 404 when DLQ job is not found', async () => {
      mockGetDlqJob.mockResolvedValue(null);

      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'] });
      const response = await request(app).get('/api/scraper/dlq/missing-job');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('DLQ job not found');
    });

    it('should return 403 when user lacks scraper trigger permission', async () => {
      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: [] });
      const response = await request(app).get('/api/scraper/dlq/job-1');

      expect(response.status).toBe(403);
      expect(mockGetDlqJob).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/scraper/dlq/:jobId/retry', () => {
    it('should requeue a DLQ job and return success payload', async () => {
      mockRetryDlqJob.mockResolvedValue({
        job_id: 'report-2',
        retry_count: 0,
      });

      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'], org_id: 7 });
      const response = await request(app).post('/api/scraper/dlq/report-2/retry');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe('report-2');
      expect(response.body.data.retry_count).toBe(0);
      expect(mockRetryDlqJob).toHaveBeenCalledWith('report-2', 7);
    });

    it('should return 404 when DLQ job does not exist', async () => {
      mockRetryDlqJob.mockResolvedValue(null);

      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'] });
      const response = await request(app).post('/api/scraper/dlq/missing-job/retry');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('DLQ job not found');
    });

    it('should return the retried job payload with reset nested retryCount', async () => {
      mockRetryDlqJob.mockResolvedValue({
        job_id: 'report-3',
        retry_count: 0,
        job: {
          type: 'scrape',
          triggerType: 'manual',
          reportId: 3,
          retryCount: 0,
        },
      });

      const app = await setupApp({ role_name: 'user', is_system_role: false, permissions: ['scraper:trigger'], org_id: 7 });
      const response = await request(app).post('/api/scraper/dlq/report-3/retry');

      expect(response.status).toBe(200);
      expect(response.body.data.retry_count).toBe(0);
      expect(response.body.data.job.retryCount).toBe(0);
    });
  });

  describe('Admin alias routes (/api/admin/scraper/dlq)', () => {
    async function setupAppWithAlias(mockUser?: any) {
      if (mockUser) {
        currentMockUser = { role_name: 'admin', is_system_role: true, permissions: [], id: 1, username: 'admin', ...mockUser };
      }
      const { default: scraperRouter } = await import('./scraper.js');
      const app = express();
      app.use(express.json());
      app.set('db', {});
      app.use('/api/scraper', scraperRouter);
      mountAdminScraperDlqAlias(app, scraperRouter);
      app.use(errorHandler);
      return app;
    }

    it('GET /api/admin/scraper/dlq should return same response as canonical GET /api/scraper/dlq', async () => {
      mockListDlqJobs.mockResolvedValue({ jobs: [{ job_id: 'report-1' }], total: 1, page: 1, pageSize: 50 });

      const app = await setupAppWithAlias({ role_name: 'admin', is_system_role: true, permissions: [] });
      const response = await request(app).get('/api/admin/scraper/dlq');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs[0].job_id).toBe('report-1');
    });

    it('GET /api/admin/scraper/dlq/:jobId should return same response as canonical GET /api/scraper/dlq/:jobId', async () => {
      mockGetDlqJob.mockResolvedValue({ job_id: 'report-2', retry_count: 0 });

      const app = await setupAppWithAlias({ role_name: 'admin', is_system_role: true, permissions: [] });
      const response = await request(app).get('/api/admin/scraper/dlq/report-2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe('report-2');
    });

    it('POST /api/admin/scraper/dlq/:jobId/retry should return same response as canonical POST /api/scraper/dlq/:jobId/retry', async () => {
      mockRetryDlqJob.mockResolvedValue({ job_id: 'report-3', retry_count: 0 });

      const app = await setupAppWithAlias({ role_name: 'admin', is_system_role: true, permissions: [] });
      const response = await request(app).post('/api/admin/scraper/dlq/report-3/retry');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe('report-3');
    });

    it('GET /api/admin/scraper/dlq/ should accept the same trailing-slash form as the canonical route', async () => {
      mockListDlqJobs.mockResolvedValue({ jobs: [{ job_id: 'report-1' }], total: 1, page: 1, pageSize: 50 });

      const app = await setupAppWithAlias({ role_name: 'admin', is_system_role: true, permissions: [] });
      const response = await request(app).get('/api/admin/scraper/dlq/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs[0].job_id).toBe('report-1');
    });

    it('GET /api/admin/scraper/status should remain unavailable', async () => {
      const app = await setupAppWithAlias({ role_name: 'admin', is_system_role: true, permissions: [] });
      const response = await request(app).get('/api/admin/scraper/status');

      expect(response.status).toBe(404);
      expect(mockGetStatus).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/scraper/resume/:reportId', () => {
    it('should pass observability context to triggerResume', async () => {
      const app = await setupApp();

      const response = await request(app).post('/api/scraper/resume/123');

      expect(response.status).toBe(200);
      expect(mockTriggerResume).toHaveBeenCalledWith(
        123,
        expect.any(Array),
        expect.objectContaining({
          endpoint: '/api/scraper/resume/123',
          method: 'POST',
          user: expect.objectContaining({ id: 1 }),
        })
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Scraper resume requested',
        expect.objectContaining({
          org_id: undefined,
          user_id: 1,
          endpoint: '/api/scraper/resume/123',
          method: 'POST',
          report_id: 123,
          pending_attempts: 1,
        })
      );
    });

    it('forwards traceparent header to observability context', async () => {
      const app = await setupApp();

      const response = await request(app)
        .post('/api/scraper/trigger')
        .set('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
        .send({});

      expect(response.status).toBe(200);
      expect(mockTriggerScrape).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        })
      );
    });

    it('rejects invalid traceparent header values', async () => {
      const app = await setupApp();

      const response = await request(app)
        .post('/api/scraper/trigger')
        .set('traceparent', 'invalid-value')
        .send({});

      expect(response.status).toBe(200);
      expect(mockTriggerScrape).toHaveBeenCalledWith(
        {},
        expect.not.objectContaining({
          traceparent: expect.any(String),
        })
      );
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
      expect(mockTriggerScrape).toHaveBeenCalledWith(
        { cinemaId: undefined },
        expect.objectContaining({
          endpoint: '/api/scraper/schedules/1/trigger',
          method: 'POST',
          user: expect.objectContaining({ id: 1 }),
        })
      );
    });
  });
});
