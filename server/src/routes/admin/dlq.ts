import express, { Response, NextFunction } from 'express';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { protectedLimiter } from '../../middleware/rate-limit.js';
import { getRedisClient } from '../../services/redis-client.js';
import type { ApiResponse } from '../../types/api.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { parseStrictInt } from '../../utils/number.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/admin/dlq/jobs
 * List dead-letter queue jobs with pagination.
 * Returns jobs sorted by failed_at timestamp descending.
 */
router.get('/jobs', protectedLimiter, requireAuth, requirePermission('scraper:trigger'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseStrictInt(req.query.page);
    const pageSize = parseStrictInt(req.query.pageSize);
    const normalizedPage = Number.isNaN(page) ? 1 : Math.max(1, page);
    const normalizedPageSize = Number.isNaN(pageSize) ? 20 : Math.min(Math.max(1, pageSize), 100);

    const result = await getRedisClient().listDlqJobs(
      normalizedPageSize,
      normalizedPage,
      req.user?.is_system_role ? undefined : req.user?.org_id,
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/dlq/jobs/:jobId
 * Get full details for a specific DLQ job.
 * Returns the complete original payload and failure context.
 */
router.get('/jobs/:jobId', protectedLimiter, requireAuth, requirePermission('scraper:trigger'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : undefined;
    if (!jobId) {
      return next(new ValidationError('Invalid DLQ job ID'));
    }

    const entry = await getRedisClient().getDlqJobById(
      jobId,
      req.user?.is_system_role ? undefined : req.user?.org_id,
    );

    if (!entry) {
      return next(new NotFoundError('DLQ job not found'));
    }

    const response: ApiResponse = {
      success: true,
      data: entry,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/dlq/jobs/:jobId/retry
 * Requeue a dead-lettered job back to the main scraper queue.
 * Returns 202 Accepted with the republished job details.
 */
router.post('/jobs/:jobId/retry', protectedLimiter, requireAuth, requirePermission('scraper:trigger'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : undefined;
    if (!jobId) {
      return next(new ValidationError('Invalid DLQ job ID'));
    }

    const retried = await getRedisClient().retryDlqJob(
      jobId,
      req.user?.is_system_role ? undefined : req.user?.org_id,
    );

    if (!retried) {
      return next(new NotFoundError('DLQ job not found'));
    }

    logger.info('[Admin DLQ] Job retried from DLQ', {
      job_id: retried.job_id,
      user_id: req.user?.id,
      org_id: req.user?.org_id,
    });

    res.status(202).json({
      success: true,
      data: retried,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
