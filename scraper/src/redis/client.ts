import Redis from 'ioredis';
import type { ProgressEvent, ScrapeSummary } from '../types/scraper.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleChangeEvent {
  action: 'created' | 'updated' | 'deleted';
  scheduleId: number;
  schedule?: {
    id: number;
    name: string;
    cron_expression: string;
    enabled: boolean;
    target_cinemas?: string[] | null;
  };
}

interface BaseScrapeJob {
  reportId: number;
  /** OpenTelemetry trace context propagated from the HTTP request */
  traceContext?: Record<string, string>;
  /**
   * SaaS mode: the org slug identifies which PostgreSQL schema to write to.
   * Absent in standalone mode (data goes to the public schema).
   */
  org_slug?: string;
}

export interface ScrapeJobScrape extends BaseScrapeJob {
  type: 'scrape';
  triggerType: 'manual' | 'cron';
  options?: {
    mode?: 'weekly' | 'from_today' | 'from_today_limited';
    days?: number;
    cinemaId?: string;
    filmId?: number;
  };
}

export interface ScrapeJobAddCinema extends BaseScrapeJob {
  type: 'add_cinema';
  triggerType: 'manual';
  /** The Allociné cinema URL to add and scrape */
  url: string;
}

/**
 * Discriminated union of all job types the scraper can process.
 * Use `job.type` (or check for presence of the field for legacy jobs) to
 * narrow to a concrete job variant.
 */
export type ScrapeJob = ScrapeJobScrape | ScrapeJobAddCinema;

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

        logger.info('[RedisJobConsumer] Received job', { reportId: job.reportId, type: job.type, trigger: job.triggerType });

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
// RedisScheduleSubscriber – listens for schedule change events
// ---------------------------------------------------------------------------

export class RedisScheduleSubscriber {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { lazyConnect: false });
  }

  async subscribe(channel: string, handler: (event: ScheduleChangeEvent) => void): Promise<void> {
    await this.client.subscribe(channel);

    this.client.on('message', (ch: string, message: string) => {
      if (ch !== channel) return;
      try {
        const event: ScheduleChangeEvent = JSON.parse(message);
        handler(event);
      } catch (err) {
        logger.error('[RedisScheduleSubscriber] Failed to parse schedule event:', err);
      }
    });

    logger.info(`[RedisScheduleSubscriber] Subscribed to channel: ${channel}`);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// ---------------------------------------------------------------------------
// RoundRobinJobConsumer – fair multi-queue consumer for SaaS worker isolation
// ---------------------------------------------------------------------------

/**
 * Consumes jobs from multiple per-org queues using a single BLPOP call.
 *
 * Redis BLPOP with multiple keys implements left-to-right priority, not true
 * round-robin. To prevent starvation we rotate the key order on each iteration
 * so that no single org monopolises the worker.
 *
 * Usage in SaaS consumer mode:
 *   const consumer = new RoundRobinJobConsumer(redisUrl);
 *   const queues = orgs.map(slug => `scrape:jobs:org_${slug}`);
 *   await consumer.start(queues, handler);
 */
export class RoundRobinJobConsumer {
  private client: Redis;
  private running = false;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { lazyConnect: false });
  }

  /**
   * Start consuming jobs from the provided queue keys.
   * Rotates key order each loop iteration for fairness.
   * Calls handler for each job. Blocks waiting for jobs (BLPOP timeout=5s).
   */
  async start(queueKeys: string[], handler: (job: ScrapeJob) => Promise<void>): Promise<void> {
    this.running = true;
    logger.info('[RoundRobinJobConsumer] Waiting for jobs', { queues: queueKeys });

    // Mutable rotation index — increments each iteration
    let rotationOffset = 0;

    while (this.running) {
      try {
        // Rotate key order to implement fair round-robin
        const rotated = [
          ...queueKeys.slice(rotationOffset),
          ...queueKeys.slice(0, rotationOffset),
        ];
        rotationOffset = (rotationOffset + 1) % Math.max(queueKeys.length, 1);

        const result = await this.client.blpop(...rotated, 5);

        if (!result) continue;

        const [_key, raw] = result;
        let job: ScrapeJob;
        try {
          job = JSON.parse(raw);
        } catch (err) {
          logger.error('[RoundRobinJobConsumer] Failed to parse job', { raw, err });
          continue;
        }

        logger.info('[RoundRobinJobConsumer] Received job', {
          reportId: job.reportId,
          type: job.type,
          org_slug: job.org_slug,
        });

        try {
          await handler(job);
        } catch (err) {
          logger.error('[RoundRobinJobConsumer] Job handler failed', { err });
        }
      } catch (err: any) {
        if (!this.running) break;
        logger.error('[RoundRobinJobConsumer] Error polling queues', { err });
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    logger.info('[RoundRobinJobConsumer] Stopped.');
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
let _subscriber: RedisScheduleSubscriber | null = null;

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

export function getRedisSubscriber(): RedisScheduleSubscriber {
  if (!_subscriber) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _subscriber = new RedisScheduleSubscriber(url);
  }
  return _subscriber;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([
    _publisher?.disconnect(),
    _consumer?.disconnect(),
    _subscriber?.disconnect(),
  ]);
  _publisher = null;
  _consumer = null;
  _subscriber = null;
}
