import { parseStrictInt } from '../utils/number.js';
import express from 'express';
import type { DB } from '../db/client.js';
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

    const report = await getScrapeReport(db, reportId);

    if (!report) {
      return next(new NotFoundError('Report not found'));
    }

    // Get all attempts for this report
    const attempts = await getScrapeAttemptsByReport(db, reportId);

    // Group attempts by cinema
    const attemptsByCinema: Record<string, any[]> = {};
    for (const attempt of attempts) {
      if (!attemptsByCinema[attempt.cinema_id]) {
        attemptsByCinema[attempt.cinema_id] = [];
      }
      attemptsByCinema[attempt.cinema_id].push(attempt);
    }

    // Calculate summary statistics
    const summary = {
      total_attempts: attempts.length,
      successful: attempts.filter(a => a.status === 'success').length,
      failed: attempts.filter(a => a.status === 'failed').length,
      rate_limited: attempts.filter(a => a.status === 'rate_limited').length,
      not_attempted: attempts.filter(a => a.status === 'not_attempted').length,
      pending: attempts.filter(a => a.status === 'pending').length,
    };

    const response: ApiResponse = {
      success: true,
      data: {
        report,
        attempts: attemptsByCinema,
        summary,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
