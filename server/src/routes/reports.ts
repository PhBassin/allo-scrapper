import express from 'express';
import type { DB } from '../db/client.js';
import { getScrapeReports, getScrapeReport } from '../db/queries.js';
import type { ApiResponse, PaginatedResponse, GetReportsQuery } from '../types/api.js';
import type { ScrapeReport } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

// GET /api/reports - Get all scrape reports (paginated)
router.get('/', protectedLimiter, requireAuth, requirePermission('reports:list'), async (req, res) => {
  try {
    const db: DB = req.app.get('db');
    const query = req.query as GetReportsQuery;
    let page = parseInt(query.page || '1');
    let pageSize = parseInt(query.pageSize || '20');

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
    logger.error('Error fetching reports:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch reports',
    };
    res.status(500).json(response);
  }
});

// GET /api/reports/:id - Get a specific report
router.get('/:id', protectedLimiter, requireAuth, requirePermission('reports:view'), async (req, res) => {
  try {
    const db: DB = req.app.get('db');
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid report ID',
      };
      return res.status(400).json(response);
    }

    const report = await getScrapeReport(db, reportId);

    if (!report) {
      const response: ApiResponse = {
        success: false,
        error: 'Report not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: report,
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error fetching report:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch report',
    };
    return res.status(500).json(response);
  }
});

export default router;
