import { getRedisClient } from './redis-client.js';
import { progressTracker } from './progress-tracker.js';
import { createScrapeReport, getLatestScrapeReport } from '../db/report-queries.js';
import { getCinemas } from '../db/cinema-queries.js';
import type { DB } from '../db/client.js';
import { logger } from '../utils/logger.js';

export class ScraperService {
  constructor(private db: DB) {}

  /**
   * Triggers a new scrape job by publishing it to the Redis queue.
   * Validates the cinemaId if provided.
   */
  async triggerScrape(options: { cinemaId?: string; filmId?: number } = {}) {
    const { cinemaId, filmId } = options;

    // Validate cinemaId exists in database if provided
    if (cinemaId) {
      const cinemas = await getCinemas(this.db);
      const cinemaExists = cinemas.some(c => c.id === cinemaId);

      if (!cinemaExists) {
        throw new Error(`Cinema not found: ${cinemaId}`);
      }
    }

    const reportId = await createScrapeReport(this.db, 'manual');

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

    return { reportId, queueDepth };
  }

  /**
   * Retrieves the current status of the scraper based on the latest report.
   */
  async getStatus() {
    const latestReport = await getLatestScrapeReport(this.db);
    return {
      isRunning: latestReport?.status === 'running',
      latestReport,
    };
  }

  /**
   * Subscribes an HTTP response stream to the progress tracker events.
   */
  subscribeToProgress(res: any, onClose: () => void) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    progressTracker.addListener(res);
    logger.info(`📡 SSE client connected (${progressTracker.getListenerCount()} total)`);

    return () => {
      progressTracker.removeListener(res);
      logger.info(`📡 SSE client disconnected (${progressTracker.getListenerCount()} remaining)`);
      onClose();
    };
  }
}
