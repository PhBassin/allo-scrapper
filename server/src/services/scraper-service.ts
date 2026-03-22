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

    // Clear stale events so new SSE subscribers don't receive previous session's
    // completed/failed events and immediately dismiss the progress panel.
    // Note: We use clearEvents() instead of reset() to keep existing SSE connections
    // alive - they will continue receiving events from the new scrape session.
    progressTracker.clearEvents();

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
   * Retrieves the current status of the scraper.
   * Checks both the latest database report AND active ProgressTracker events
   * to handle race conditions where events are being emitted before UI mounts.
   */
  async getStatus() {
    const latestReport = await getLatestScrapeReport(this.db);
    const activeEvents = progressTracker.getEvents();
    
    // Check if scrape is actively running based on:
    // 1. Latest report status is 'running', AND
    // 2. Either no events yet, OR events exist but haven't completed/failed
    const hasActiveEvents = activeEvents.length > 0;
    const lastEvent = activeEvents[activeEvents.length - 1];
    const isEventStreamComplete = lastEvent?.type === 'completed' || lastEvent?.type === 'failed';
    
    // isRunning = true if:
    // - DB report shows running AND events haven't completed yet, OR
    // - We have active events that haven't completed/failed (even if DB report is stale)
    const isRunning = (latestReport?.status === 'running' && !isEventStreamComplete) || 
                      (hasActiveEvents && !isEventStreamComplete);

    // Build currentSession info if scrape is running
    const currentSession = isRunning && latestReport ? {
      reportId: latestReport.id,
      triggerType: latestReport.trigger_type,
      startedAt: latestReport.started_at,
      status: latestReport.status,
    } : undefined;

    return {
      isRunning,
      latestReport,
      currentSession,
    };
  }

  /**
   * Subscribes an HTTP response stream to the progress tracker events.
   */
  subscribeToProgress(res: any, onClose: () => void) {
    // Set SSE headers BEFORE any write operations
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Additional headers for browser compatibility
    res.setHeader('Access-Control-Allow-Origin', res.req?.headers?.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Prevent any response compression
    res.setHeader('Content-Encoding', 'identity');

    progressTracker.addListener(res);
    logger.info(`📡 SSE client connected (${progressTracker.getListenerCount()} total)`);

    return () => {
      progressTracker.removeListener(res);
      logger.info(`📡 SSE client disconnected (${progressTracker.getListenerCount()} remaining)`);
      onClose();
    };
  }
}
