import express from 'express';
import { getRedisClient } from '../services/redis-client.js';
import { progressTracker } from '../services/progress-tracker.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';
import { createScrapeReport, getLatestScrapeReport } from '../db/report-queries.js';
import { getCinemas } from '../db/cinema-queries.js';
import type { DB } from '../db/client.js';
import { db } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { scraperLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

// POST /api/scraper/trigger - Start a manual scrape (delegates to Redis microservice)
router.post('/trigger', scraperLimiter, requireAuth, async (req: AuthRequest, res) => {
  const dbConn: DB = req.app.get('db');

  try {
    // Extract and validate cinemaId and filmId from request body
    const { cinemaId, filmId } = req.body as { cinemaId?: string; filmId?: number };

    // Permission check: scraper:trigger for all-cinema scrape, scraper:trigger_single for single-cinema
    // scraper:trigger is a superset (allows both all-cinema and single-cinema)
    const requiredPermission = cinemaId ? 'scraper:trigger_single' : 'scraper:trigger';

    // Admin bypass
    if (!(req.user?.role_name === 'admin' && req.user?.is_system_role)) {
      const userPermissions = new Set(req.user?.permissions || []);
      
      // User needs the specific permission OR scraper:trigger (which grants both)
      if (!userPermissions.has(requiredPermission) && !userPermissions.has('scraper:trigger')) {
        const response: ApiResponse = {
          success: false,
          error: 'Permission denied',
        };
        return res.status(403).json(response);
      }
    }

    // Validate cinemaId exists in database if provided
    if (cinemaId) {
      const cinemas = await getCinemas(dbConn);
      const cinemaExists = cinemas.some(c => c.id === cinemaId);

      if (!cinemaExists) {
        const response: ApiResponse = {
          success: false,
          error: `Cinema not found: ${cinemaId}`,
        };
        return res.status(404).json(response);
      }
    }

    const reportId = await createScrapeReport(db, 'manual');

    // Reset stale events so new SSE subscribers don't receive previous session's
    // completed/failed events and immediately dismiss the progress panel.
    progressTracker.reset();

    const queueDepth = await getRedisClient().publishJob({
      type: 'scrape',
      reportId,
      triggerType: 'manual',
      options: {
        ...(cinemaId && { cinemaId }),
        ...(filmId && { filmId }),
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        reportId,
        message: 'Scrape job queued for microservice',
        queueDepth,
      },
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error starting scrape:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to start scrape',
    };
    return res.status(500).json(response);
  }
});

// GET /api/scraper/status - Get current scrape status
router.get('/status', async (_req, res) => {
  try {
    const latestReport = await getLatestScrapeReport(db);

    const response: ApiResponse = {
      success: true,
      data: {
        isRunning: latestReport?.status === 'running',
        latestReport,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching scrape status:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch scrape status',
    };
    res.status(500).json(response);
  }
});

// GET /api/scraper/progress - SSE endpoint for real-time progress
router.get('/progress', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Add listener to progress tracker
  // progressTracker.emit() is called from the Redis subscriber in index.ts
  progressTracker.addListener(res);

  logger.info(`📡 SSE client connected (${progressTracker.getListenerCount()} total)`);

  // Remove listener on client disconnect
  req.on('close', () => {
    progressTracker.removeListener(res);
    logger.info(`📡 SSE client disconnected (${progressTracker.getListenerCount()} remaining)`);
  });
});

export default router;
