import Redis from 'ioredis';
import type { ProgressEvent } from './progress-tracker.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeJob {
  reportId: number;
  triggerType: 'manual' | 'cron';
  options?: {
    mode?: 'weekly' | 'from_today' | 'from_today_limited';
    days?: number;
  };
  /** OpenTelemetry trace context propagated from the HTTP request */
  traceContext?: Record<string, string>;
}

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
