import Redis from 'ioredis';
import type { ProgressEvent, ScrapeSummary } from '../types/scraper.js';
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
// RedisProgressPublisher – implements ProgressPublisher interface
// ---------------------------------------------------------------------------

export class RedisProgressPublisher {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { lazyConnect: false });
  }

  /** Publish a progress event to the scrape:progress pub/sub channel. */
  async emit(event: ProgressEvent): Promise<void> {
    await this.client.publish('scrape:progress', JSON.stringify(event));
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// ---------------------------------------------------------------------------
// RedisJobConsumer – blocks on scrape:jobs list, processes one job at a time
// ---------------------------------------------------------------------------

export class RedisJobConsumer {
  private client: Redis;
  private running = false;

  constructor(redisUrl: string) {
    // Use a separate connection for blocking operations
    this.client = new Redis(redisUrl, { lazyConnect: false });
  }

  /**
   * Start consuming jobs from the scrape:jobs queue.
   * Calls handler for each job. Blocks waiting for jobs (BLPOP).
   */
  async start(handler: (job: ScrapeJob) => Promise<void>): Promise<void> {
    this.running = true;
    logger.info('[RedisJobConsumer] Waiting for scrape jobs on scrape:jobs');

    while (this.running) {
      try {
        // Block for up to 5 seconds, then loop to allow clean shutdown
        const result = await this.client.blpop('scrape:jobs', 5);

        if (!result) continue; // Timeout, loop again

        const [_key, raw] = result;
        let job: ScrapeJob;
        try {
          job = JSON.parse(raw);
        } catch (err) {
          logger.error('[RedisJobConsumer] Failed to parse job', { raw, err });
          continue;
        }

        logger.info('[RedisJobConsumer] Received job', { reportId: job.reportId, trigger: job.triggerType });

        try {
          await handler(job);
        } catch (err) {
          logger.error('[RedisJobConsumer] Job handler failed', { err });
        }
      } catch (err: any) {
        // If connection closed cleanly during shutdown, stop
        if (!this.running) break;
        logger.error('[RedisJobConsumer] Error polling queue', { err });
        // Brief pause to avoid tight loop on persistent errors
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    logger.info('[RedisJobConsumer] Stopped.');
  }

  stop(): void {
    this.running = false;
  }

  async disconnect(): Promise<void> {
    this.stop();
    await this.client.quit();
  }
}

// ---------------------------------------------------------------------------
// Singleton helpers
// ---------------------------------------------------------------------------

let _publisher: RedisProgressPublisher | null = null;
let _consumer: RedisJobConsumer | null = null;

export function getRedisPublisher(): RedisProgressPublisher {
  if (!_publisher) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _publisher = new RedisProgressPublisher(url);
  }
  return _publisher;
}

export function getRedisConsumer(): RedisJobConsumer {
  if (!_consumer) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _consumer = new RedisJobConsumer(url);
  }
  return _consumer;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([
    _publisher?.disconnect(),
    _consumer?.disconnect(),
  ]);
  _publisher = null;
  _consumer = null;
}
