import express from 'express';
import { scrapeManager } from '../services/scrape-manager.js';
import { progressTracker } from '../services/progress-tracker.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const USE_REDIS_SCRAPER = process.env.USE_REDIS_SCRAPER === 'true';

// POST /api/scraper/trigger - Start a manual scrape
router.post('/trigger', async (req, res) => {
  try {
    const rawFilmId = req.body?.filmId;
    const filmId = rawFilmId === undefined ? undefined : Number(rawFilmId);
    if (filmId !== undefined && (!Number.isInteger(filmId) || filmId <= 0)) {
      const response: ApiResponse = {
        success: false,
        error: 'filmId must be a positive integer',
      };
      return res.status(400).json(response);
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
        ...(filmId ? { options: { filmId } } : {}),
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

    const reportId = await scrapeManager.startScrape('manual', filmId ? { filmId } : undefined);

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
