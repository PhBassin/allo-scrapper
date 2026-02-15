import express from 'express';
import { db } from '../db/client.js';
import { getScrapeReports, getScrapeReport } from '../db/queries.js';
import type { ApiResponse, PaginatedResponse, GetReportsQuery } from '../types/api.js';
import type { ScrapeReport } from '../db/queries.js';

const router = express.Router();

// GET /api/reports - Get all scrape reports (paginated)
router.get('/', async (req, res) => {
  try {
    const query = req.query as GetReportsQuery;
    const page = parseInt(query.page || '1');
    const pageSize = parseInt(query.pageSize || '20');
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
    console.error('Error fetching reports:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch reports',
    };
    res.status(500).json(response);
  }
});

// GET /api/reports/:id - Get a specific report
router.get('/:id', async (req, res) => {
  try {
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
    console.error('Error fetching report:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch report',
    };
    return res.status(500).json(response);
  }
});

export default router;
