import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { DB } from '../../db/client.js';

// Mock dependencies BEFORE importing the router
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, username: 'admin', role_name: 'admin', is_system_role: true, org_id: undefined };
      next();
    } else {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  },
}));
vi.mock('../../middleware/rate-limit.js', () => ({
  protectedLimiter: (req: any, res: any, next: any) => next(),
}));
vi.mock('../../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) => (req: any, res: any, next: any) => next(),
}));

const mockListDlqJobs = vi.fn();
const mockGetDlqJobById = vi.fn();
const mockRetryDlqJob = vi.fn();

vi.mock('../../services/redis-client.js', () => ({
  getRedisClient: () => ({
    listDlqJobs: mockListDlqJobs,
    getDlqJobById: mockGetDlqJobById,
    retryDlqJob: mockRetryDlqJob,
  }),
}));

// Import router AFTER mocks are set up
import dlqRouter from './dlq.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Routes - Admin - DLQ (Dead-Letter Queue)', () => {
  let app: express.Application;
  const mockDb: DB = {
    query: vi.fn(),
  } as unknown as DB;

  const mockDlqJob = {
    job_id: 'report-42',
    failure_reason: 'Redis connection timeout',
    retry_count: 3,
    timestamp: '2026-04-26T10:00:00.000Z',
    cinema_id: 'cinema-1',
    org_id: 'org-1',
    org_slug: 'acme',
    user_id: 'user-1',
    endpoint: '/api/scraper/trigger',
    job: {
      type: 'scrape' as const,
      triggerType: 'manual' as const,
      reportId: 42,
      retryCount: 3,
      options: { mode: 'weekly' as const, cinemaId: 'cinema-1' },
    },
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.set('db', mockDb);
    app.use('/api/admin/dlq', dlqRouter);
    app.use(errorHandler);

    vi.clearAllMocks();
  });

  describe('GET /api/admin/dlq/jobs', () => {
    it('should return paginated DLQ jobs sorted by failed_at descending', async () => {
      mockListDlqJobs.mockResolvedValue({
        jobs: [
          { job_id: 'report-2', timestamp: '2026-04-26T11:00:00.000Z', failure_reason: 'timeout', retry_count: 3, job: { reportId: 2, retryCount: 0 } },
          { job_id: 'report-1', timestamp: '2026-04-26T10:00:00.000Z', failure_reason: 'error', retry_count: 3, job: { reportId: 1, retryCount: 0 } },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      });

      const response = await request(app)
        .get('/api/admin/dlq/jobs?page=1&pageSize=20')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toHaveLength(2);
      expect(response.body.data.jobs[0].job_id).toBe('report-2');
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(20);
    });

    it('should use default pagination (page=1, pageSize=20) when not provided', async () => {
      mockListDlqJobs.mockResolvedValue({
        jobs: [mockDlqJob],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      const response = await request(app)
        .get('/api/admin/dlq/jobs')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should enforce max page size of 100', async () => {
      mockListDlqJobs.mockResolvedValue({
        jobs: [],
        total: 0,
        page: 1,
        pageSize: 100,
      });

      await request(app)
        .get('/api/admin/dlq/jobs?page=1&pageSize=999')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });

    it('should return empty list when DLQ is empty', async () => {
      mockListDlqJobs.mockResolvedValue({
        jobs: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      const response = await request(app)
        .get('/api/admin/dlq/jobs')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toHaveLength(0);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('GET /api/admin/dlq/jobs/:jobId', () => {
    it('should return full DLQ job details including complete payload', async () => {
      mockGetDlqJobById.mockResolvedValue(mockDlqJob);

      const response = await request(app)
        .get('/api/admin/dlq/jobs/report-42')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe('report-42');
      expect(response.body.data.failure_reason).toBe('Redis connection timeout');
      expect(response.body.data.job).toBeDefined();
      expect(response.body.data.retry_count).toBe(3);
    });

    it('should return 404 when DLQ job does not exist', async () => {
      mockGetDlqJobById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/dlq/jobs/nonexistent-job')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('DLQ job not found');
    });
  });

  describe('POST /api/admin/dlq/jobs/:jobId/retry', () => {
    it('should requeue a DLQ job and return 202 Accepted', async () => {
      mockRetryDlqJob.mockResolvedValue({
        job_id: 'report-42',
        retry_count: 0,
        job: { type: 'scrape', triggerType: 'manual', reportId: 42, retryCount: 0 },
      });

      const response = await request(app)
        .post('/api/admin/dlq/jobs/report-42/retry')
        .set('Authorization', 'Bearer valid-token')
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe('report-42');
      expect(response.body.data.retry_count).toBe(0);
    });

    it('should return 404 when retrying a non-existent DLQ job', async () => {
      mockRetryDlqJob.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/dlq/jobs/missing-job/retry')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('DLQ job not found');
    });
  });

  describe('Authentication (AC: 4)', () => {
    it('should return 401 for GET /api/admin/dlq/jobs without auth', async () => {
      const response = await request(app)
        .get('/api/admin/dlq/jobs')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 for GET /api/admin/dlq/jobs/:jobId without auth', async () => {
      const response = await request(app)
        .get('/api/admin/dlq/jobs/report-42')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 for POST /api/admin/dlq/jobs/:jobId/retry without auth', async () => {
      const response = await request(app)
        .post('/api/admin/dlq/jobs/report-42/retry')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });
  });
});
