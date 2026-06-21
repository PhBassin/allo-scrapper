import { parseStrictInt } from '../utils/number.js';
import express from 'express';
import type { DB } from '../db/index.js';
import { getScrapeReports, getScrapeReport } from '../db/report-queries.js';
import type { ApiResponse, PaginatedResponse, GetReportsQuery } from '../types/api.js';
import type { ScrapeReport } from '../db/report-queries.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { getScrapeAttemptsByReport } from '../db/scrape-attempt-queries.js';

const router = express.Router();

// GET /api/reports - Get all scrape reports (paginated)
router.get('/', protectedLimiter, requireAuth, requirePermission('reports:list'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const query = req.query as GetReportsQuery;
    let page = parseStrictInt(query.page || '1');
    let pageSize = parseStrictInt(query.pageSize || '20');

    // Security: Validate and clamp pagination parameters to prevent DoS
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 20;
    if (pageSize > 100) pageSize = 100;

    const status = query.status;
    const triggerType = query.triggerType;

    const offset = (page - 1) * pageSize;

    const { reports, total } = await getScrapeReports(db, {
      limit: pageSize,
      offset,
      status,
      triggerType,
    });

    const totalPages = Math.ceil(total / pageSize);

    const paginatedResponse: PaginatedResponse<ScrapeReport> = {
      items: reports,
      total,
      page,
      pageSize,
      totalPages,
    };

    const response: ApiResponse = {
      success: true,
      data: paginatedResponse,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id - Get a specific report
router.get('/:id', protectedLimiter, requireAuth, requirePermission('reports:view'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const reportId = parseStrictInt(req.params.id);

    if (isNaN(reportId)) {
      return next(new ValidationError('Invalid report ID'));
    }

    const report = await getScrapeReport(db, reportId);

    if (!report) {
      return next(new NotFoundError('Report not found'));
    }

    const response: ApiResponse = {
      success: true,
      data: report,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id/details - Get report with detailed attempt breakdown
router.get('/:id/details', protectedLimiter, requireAuth, requirePermission('reports:view'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const reportId = parseStrictInt(req.params.id);

    if (isNaN(reportId)) {
      return next(new ValidationError('Invalid report ID'));
    }

    // Fetch report and attempts concurrently (Promise.all)
    const [report, attempts] = await Promise.all([
      getScrapeReport(db, reportId),
      getScrapeAttemptsByReport(db, reportId),
    ]);

    if (!report) {
      return next(new NotFoundError('Report not found'));
    }

    // Group attempts by theater and calculate summary statistics in a single pass
    const attemptsByTheater: Record<string, any[]> = {};
    let successful = 0;
    let failed = 0;
    let rate_limited = 0;
    let not_attempted = 0;
    let pending = 0;

    for (const attempt of attempts) {
      const theaterId = attempt.theater_id;
      if (!attemptsByTheater[theaterId]) {
        attemptsByTheater[theaterId] = [];
      }
      attemptsByTheater[theaterId].push(attempt);

      const status = attempt.status;
      if (status === 'success') {
        successful++;
      } else if (status === 'failed') {
        failed++;
      } else if (status === 'rate_limited') {
        rate_limited++;
      } else if (status === 'not_attempted') {
        not_attempted++;
      } else if (status === 'pending') {
        pending++;
      }
    }

    const summary = {
      total_attempts: attempts.length,
      successful,
      failed,
      rate_limited,
      not_attempted,
      pending,
    };

    const response: ApiResponse = {
      success: true,
      data: {
        report,
        attempts: attemptsByTheater,
        summary,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
