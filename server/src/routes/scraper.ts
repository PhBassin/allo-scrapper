import express from 'express';
import { scrapeManager } from '../services/scrape-manager.js';
import { progressTracker } from '../services/progress-tracker.js';
import type { ApiResponse } from '../types/api.js';

const router = express.Router();

// POST /api/scraper/trigger - Start a manual scrape
router.post('/trigger', async (req, res) => {
  try {
    // Check if scrape is already running
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

    const cinemaIds: string[] | undefined = Array.isArray(req.body?.cinemaIds)
      ? req.body.cinemaIds
      : undefined;

    // Start the scrape
    const reportId = await scrapeManager.startScrape('manual', cinemaIds ? { cinemaIds } : undefined);

    const response: ApiResponse = {
      success: true,
      data: { reportId, message: 'Scrape started successfully' },
    };

    return res.json(response);
  } catch (error) {
    console.error('Error starting scrape:', error);
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
        isRunning: scrapeManager.isRunning(),
        currentSession: session,
        latestReport,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching scrape status:', error);
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
  progressTracker.addListener(res);

  console.log(`📡 SSE client connected (${progressTracker.getListenerCount()} total)`);

  // Remove listener on client disconnect
  req.on('close', () => {
    progressTracker.removeListener(res);
    console.log(`📡 SSE client disconnected (${progressTracker.getListenerCount()} remaining)`);
  });
});

export default router;
