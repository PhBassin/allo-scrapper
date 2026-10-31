import Redis from 'ioredis';
import type {
  ProgressEvent,
  ScrapeJob,
  ScrapeJobAddTheater,
  ScheduleChangeEvent,
} from 'allo-scrapper-scraper-protocol';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types — re-exported from allo-scrapper-scraper-protocol so existing
// importers keep working without churn. The wire contract lives in one place.
// ---------------------------------------------------------------------------

export type {
  ScrapeJob,
  ScrapeJobScrape,
  ScrapeJobAddTheater,
  ScheduleChangeEvent,
} from 'allo-scrapper-scraper-protocol';

// ---------------------------------------------------------------------------
// RedisClient
// ---------------------------------------------------------------------------

export class RedisClient {
  private publisher: Redis;
  private subscriber: Redis;

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl, { lazyConnect: false });
    this.subscriber = new Redis(redisUrl, { lazyConnect: false });
  }

  // --------------------------------------------------------------------------
  // Job queue (scrape:jobs)  – backend → scraper
  // --------------------------------------------------------------------------

  /** Push a scrape job onto the queue. Returns the new queue length. */
  async publishJob(job: ScrapeJob): Promise<number> {
    return this.publisher.rpush('scrape:jobs', JSON.stringify(job));
  }

  /** Push an add_theater job onto the queue. Returns the new queue length. */
  async publishAddTheaterJob(reportId: number, url: string, traceContext?: Record<string, string>): Promise<number> {
    const job: ScrapeJobAddTheater = { type: 'add_theater', triggerType: 'manual', reportId, url, ...(traceContext && { traceContext }) };
    return this.publisher.rpush('scrape:jobs', JSON.stringify(job));
  }

  /** Return the current depth of the scrape:jobs queue. */
  async getQueueDepth(): Promise<number> {
    return this.publisher.llen('scrape:jobs');
  }

  // --------------------------------------------------------------------------
  // Progress events (scrape:progress)  – scraper → backend → SSE clients
  // --------------------------------------------------------------------------

  /** Publish a progress event (called by scraper service). */
  async publishProgress(event: ProgressEvent): Promise<void> {
    await this.publisher.publish('scrape:progress', JSON.stringify(event));
  }

  /** Subscribe to real-time progress events from the scraper. */
  async subscribeToProgress(handler: (event: ProgressEvent) => void): Promise<void> {
    await this.subscriber.subscribe('scrape:progress');

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel !== 'scrape:progress') return;
      try {
        const event: ProgressEvent = JSON.parse(message);
        handler(event);
      } catch (err) {
        logger.error('[RedisClient] Failed to parse progress event:', err);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Schedule change events (scraper:schedule:changed) – server → scraper
  // --------------------------------------------------------------------------

  /** Publish a schedule change event to notify the scraper of CRUD operations. */
  async publishScheduleChange(event: ScheduleChangeEvent): Promise<void> {
    await this.publisher.publish('scraper:schedule:changed', JSON.stringify(event));
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  async disconnect(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}

// ---------------------------------------------------------------------------
// Singleton – initialised lazily so tests can mock ioredis before importing
// ---------------------------------------------------------------------------

let _instance: RedisClient | null = null;

export function getRedisClient(): RedisClient {
  if (!_instance) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _instance = new RedisClient(url);
  }
  return _instance;
}

/** Reset the singleton (useful in tests). */
export function resetRedisClient(): void {
  _instance = null;
}
