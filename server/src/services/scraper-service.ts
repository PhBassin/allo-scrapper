import { getRedisClient } from './redis-client.js';
import { progressTracker } from './progress-tracker.js';
import { createScrapeReport, getLatestScrapeReport } from '../db/report-queries.js';
import { getCinemas } from '../db/cinema-queries.js';
import type { DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { ScrapeAttempt } from '../db/scrape-attempt-queries.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { ProgressTraceContext } from './progress-tracker.js';

interface ScrapeTriggerOptions {
  cinemaId?: string;
  filmId?: number;
}

interface ScrapeObservabilityContext {
  endpoint?: string;
  method?: string;
  traceparent?: string;
  user?: AuthRequest['user'];
}

export class ScraperService {
  constructor(private db: DB) {}

  private buildTraceContext(context?: ScrapeObservabilityContext): Record<string, string> | undefined {
    if (!context) return undefined;

    const traceContext: Record<string, string> = {};

    if (context.endpoint) {
      traceContext.endpoint = context.endpoint;
    }

    if (context.method) {
      traceContext.method = context.method;
    }

    if (context.traceparent) {
      traceContext.traceparent = context.traceparent;
    }

    if (context.user?.id !== undefined) {
      traceContext.user_id = String(context.user.id);
    }

    if (context.user?.username) {
      traceContext.username = context.user.username;
    }

    if (context.user?.org_id !== undefined) {
      traceContext.org_id = String(context.user.org_id);
    }

    if (context.user?.org_slug) {
      traceContext.org_slug = context.user.org_slug;
    }

    return Object.keys(traceContext).length > 0 ? traceContext : undefined;
  }

  private buildProgressTraceContext(context?: ScrapeObservabilityContext): ProgressTraceContext | undefined {
    const traceContext = this.buildTraceContext(context);
    if (!traceContext) return undefined;

    return {
      org_id: traceContext.org_id,
      org_slug: traceContext.org_slug,
      user_id: traceContext.user_id,
      endpoint: traceContext.endpoint,
      method: traceContext.method,
      traceparent: traceContext.traceparent,
    };
  }

  /**
   * Triggers a new scrape job by publishing it to the Redis queue.
   * Validates the cinemaId if provided.
   */
  async triggerScrape(options: ScrapeTriggerOptions = {}, context?: ScrapeObservabilityContext) {
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

    const traceContext = this.buildTraceContext(context);

    const queueDepth = await getRedisClient().publishJob({
      type: 'scrape',
      reportId,
      triggerType: 'manual',
      options: {
        ...(cinemaId && { cinemaId }),
        ...(filmId && { filmId }),
      },
      ...(traceContext && { traceContext }),
    });

    return { reportId, queueDepth };
  }

  /**
   * Triggers a resume job for a previous failed/rate-limited scrape.
   * Creates a new report linked to the parent and queues only pending attempts.
   */
  async triggerResume(parentReportId: number, pendingAttempts: ScrapeAttempt[], context?: ScrapeObservabilityContext) {
    // Create new report with parent link
    const reportId = await createScrapeReport(this.db, 'manual', parentReportId);

    // Reset stale events
    progressTracker.reset();

    // Build list of cinema/date pairs to retry
    const pendingList = pendingAttempts.map(a => ({
      cinema_id: a.cinema_id,
      date: a.date,
    }));

    const traceContext = this.buildTraceContext(context);

    const queueDepth = await getRedisClient().publishJob({
      type: 'scrape',
      reportId,
      triggerType: 'manual',
      options: {
        resumeMode: true,
        pendingAttempts: pendingList,
      },
      ...(traceContext && { traceContext }),
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
  subscribeToProgress(res: any, onClose: () => void, context?: ScrapeObservabilityContext) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    progressTracker.addListener(res, this.buildProgressTraceContext(context));
    logger.info('SSE client connected', {
      listeners: progressTracker.getListenerCount(),
      org_id: context?.user?.org_id,
      user_id: context?.user?.id,
      endpoint: context?.endpoint,
      method: context?.method,
    });

    return () => {
      progressTracker.removeListener(res);
      logger.info('SSE client disconnected', {
        listeners: progressTracker.getListenerCount(),
        org_id: context?.user?.org_id,
        user_id: context?.user?.id,
        endpoint: context?.endpoint,
        method: context?.method,
      });
      onClose();
    };
  }
}
