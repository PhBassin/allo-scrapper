import express from 'express';
import { scrapeManager } from '../services/scrape-manager.js';
import { progressTracker } from '../services/progress-tracker.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';
import { getCinemas } from '../db/queries.js';
import type { DB } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { scraperLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

const USE_REDIS_SCRAPER = process.env.USE_REDIS_SCRAPER === 'true';

// POST /api/scraper/trigger - Start a manual scrape
router.post('/trigger', requireAuth, scraperLimiter, async (req, res) => {
  const db: DB = req.app.get('db');

  try {
    // Extract and validate cinemaId and filmId from request body
    const { cinemaId, filmId } = req.body as { cinemaId?: string; filmId?: number };

    // Validate cinemaId exists in database if provided
    if (cinemaId) {
      const cinemas = await getCinemas(db);
      const cinemaExists = cinemas.some(c => c.id === cinemaId);

      if (!cinemaExists) {
        const response: ApiResponse = {
          success: false,
          error: `Cinema not found: ${cinemaId}`,
        };
        return res.status(404).json(response);
      }
    }

    if (USE_REDIS_SCRAPER) {
      // Delegate to Redis microservice
      const { getRedisClient } = await import('../services/redis-client.js');
      const { db } = await import('../db/client.js');
      const { createScrapeReport } = await import('../db/queries.js');

      const reportId = await createScrapeReport(db, 'manual');

      const queueDepth = await getRedisClient().publishJob({
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
    }

    // Legacy in-process scraper
    if (scrapeManager.isRunning()) {
      const currentSession = scrapeManager.getCurrentSession();
      const response: ApiResponse = {
        success: false,
        error: 'A scrape is already in progress',
        data: {
          current_scrape: {
            started_at: currentSession?.startedAt,
            trigger_type: currentSession?.triggerType,
          },
        },
      };
      return res.status(409).json(response);
    }

    const reportId = await scrapeManager.startScrape('manual', {
      ...(cinemaId && { cinemaId }),
      ...(filmId && { filmId }),
    });

    const response: ApiResponse = {
      success: true,
      data: { reportId, message: 'Scrape started successfully' },
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error starting scrape:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start scrape',
    };
    return res.status(500).json(response);
  }
});

// GET /api/scraper/status - Get current scrape status
router.get('/status', async (_req, res) => {
  try {
    const session = scrapeManager.getCurrentSession();
    const latestReport = await scrapeManager.getLatestReport();

    const response: ApiResponse = {
      success: true,
      data: {
        isRunning: USE_REDIS_SCRAPER ? false : scrapeManager.isRunning(),
        useRedisScraper: USE_REDIS_SCRAPER,
        currentSession: USE_REDIS_SCRAPER ? null : session,
        latestReport,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching scrape status:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch scrape status',
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
  // In Redis mode, progressTracker.emit() is called from the Redis subscriber in index.ts
  progressTracker.addListener(res);

  logger.info(`📡 SSE client connected (${progressTracker.getListenerCount()} total)`);

  // Remove listener on client disconnect
  req.on('close', () => {
    progressTracker.removeListener(res);
    logger.info(`📡 SSE client disconnected (${progressTracker.getListenerCount()} remaining)`);
  });
});

export default router;
