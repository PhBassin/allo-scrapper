import Redis from 'ioredis';
import {
  createDlqJobEntry,
  getDlqJobId,
  getScrapeJobRetryDelayMs,
  MAX_SCRAPE_JOB_RETRY_ATTEMPTS,
  SCRAPE_DLQ_KEY,
  SCRAPE_JOBS_KEY,
  type DlqJobEntry,
  type ScrapeJob,
  type ScheduleChangeEvent,
} from '@allo-scrapper/logger';
import type { ProgressEvent, ScrapeSummary } from '../types/scraper.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { DlqJobEntry, ScheduleChangeEvent, ScrapeJob };

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
  private blockingClient: Redis;
  private commandClient: Redis;
  private running = false;
  private shuttingDown = false;
  private pendingRetryOperations = new Set<Promise<void>>();
  private readonly shutdownSignal: Promise<void>;
  private resolveShutdownSignal: (() => void) | null = null;

  constructor(redisUrl: string) {
    // Keep blocking queue reads isolated so retry/DLQ writes are not delayed by BLPOP.
    this.blockingClient = new Redis(redisUrl, { lazyConnect: false });
    this.commandClient = new Redis(redisUrl, { lazyConnect: false });
    this.shutdownSignal = new Promise((resolve) => {
      this.resolveShutdownSignal = resolve;
    });
  }

  /**
   * Start consuming jobs from the scrape:jobs queue.
   * Calls handler for each job. Blocks waiting for jobs (BLPOP).
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sleepUnlessShutdown(ms: number): Promise<boolean> {
    if (this.shuttingDown) return false;

    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        resolve(true);
      }, ms);

      void this.shutdownSignal.then(() => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  private async persistTerminalFailure(entry: DlqJobEntry): Promise<void> {
    for (let persistenceAttempt = 1; ; persistenceAttempt += 1) {
      if (this.shuttingDown) return;

      try {
        await this.commandClient.zadd(SCRAPE_DLQ_KEY, Date.parse(entry.timestamp), JSON.stringify(entry));
        logger.warn('[RedisJobConsumer] Job moved to DLQ', {
          job_id: entry.job_id,
          reportId: entry.job.reportId,
          retry_count: entry.retry_count,
          timestamp: entry.timestamp,
          error: entry.failure_reason,
          org_id: entry.org_id,
        });
        return;
      } catch (persistErr) {
        if (this.shuttingDown) return;

        logger.error('[RedisJobConsumer] Failed to persist terminal job to DLQ', {
          job_id: entry.job_id,
          reportId: entry.job.reportId,
          retry_count: entry.retry_count,
          persistence_attempt: persistenceAttempt,
          timestamp: new Date().toISOString(),
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          org_id: entry.org_id,
        });

        const shouldContinue = await this.sleepUnlessShutdown(getScrapeJobRetryDelayMs(persistenceAttempt));
        if (!shouldContinue) return;
      }
    }
  }

  private async requeueFailedJob(job: ScrapeJob, nextRetryCount: number, retryDelayMs: number, failureReason: string): Promise<void> {
    logger.warn('[RedisJobConsumer] Scheduling failed job retry', {
      job_id: getDlqJobId(job),
      reportId: job.reportId,
      retry_count: nextRetryCount,
      retry_delay_ms: retryDelayMs,
      timestamp: new Date().toISOString(),
      error: failureReason,
      org_id: job.traceContext?.org_id,
    });

    const shouldContinue = await this.sleepUnlessShutdown(retryDelayMs);
    if (!shouldContinue) return;

    for (let persistenceAttempt = 1; ; persistenceAttempt += 1) {
      if (this.shuttingDown) return;

      try {
        await this.commandClient.rpush(SCRAPE_JOBS_KEY, JSON.stringify({
          ...job,
          retryCount: nextRetryCount,
        }));
        logger.warn('[RedisJobConsumer] Requeued failed job', {
          reportId: job.reportId,
          retry_count: nextRetryCount,
          org_id: job.traceContext?.org_id,
        });
        return;
      } catch (persistErr) {
        if (this.shuttingDown) return;

        logger.error('[RedisJobConsumer] Failed to requeue job after handler failure', {
          job_id: getDlqJobId(job),
          reportId: job.reportId,
          retry_count: nextRetryCount,
          persistence_attempt: persistenceAttempt,
          timestamp: new Date().toISOString(),
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          org_id: job.traceContext?.org_id,
        });

        const shouldRetry = await this.sleepUnlessShutdown(getScrapeJobRetryDelayMs(persistenceAttempt));
        if (!shouldRetry) return;
      }
    }
  }

  private trackRetryOperation(operation: Promise<void>): void {
    this.pendingRetryOperations.add(operation);
    void operation.finally(() => {
      this.pendingRetryOperations.delete(operation);
    });
  }

  async start(handler: (job: ScrapeJob) => Promise<void>): Promise<void> {
    this.running = true;
    logger.info('[RedisJobConsumer] Waiting for scrape jobs on scrape:jobs');

    while (this.running) {
      try {
        // Block for up to 5 seconds, then loop to allow clean shutdown
        const result = await this.blockingClient.blpop(SCRAPE_JOBS_KEY, 5);

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
        if (job.traceContext) {
          logger.info('[RedisJobConsumer] Job trace context', {
            reportId: job.reportId,
            org_id: job.traceContext.org_id,
            org_slug: job.traceContext.org_slug,
            user_id: job.traceContext.user_id,
            endpoint: job.traceContext.endpoint,
            method: job.traceContext.method,
          });
        }

        try {
          await handler(job);
        } catch (err) {
          const failureReason = err instanceof Error ? err.message : String(err);
          logger.error('[RedisJobConsumer] Job handler failed', {
            job_id: getDlqJobId(job),
            reportId: job.reportId,
            retry_count: (job.retryCount ?? 0) + 1,
            timestamp: new Date().toISOString(),
            error: failureReason,
          });

          const nextRetryCount = (job.retryCount ?? 0) + 1;
          if (nextRetryCount >= MAX_SCRAPE_JOB_RETRY_ATTEMPTS) {
            const entry: DlqJobEntry = createDlqJobEntry({
              job: {
                ...job,
                retryCount: nextRetryCount,
              },
              failureReason,
              retryCount: nextRetryCount,
            });

            await this.persistTerminalFailure(entry);
          } else {
            this.trackRetryOperation(
              this.requeueFailedJob(job, nextRetryCount, getScrapeJobRetryDelayMs(nextRetryCount), failureReason)
            );
          }
        }
      } catch (err: any) {
        // If connection closed cleanly during shutdown, stop
        if (!this.running) break;
        logger.error('[RedisJobConsumer] Error polling queue', { err });
        // Brief pause to avoid tight loop on persistent errors
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (this.pendingRetryOperations.size > 0) {
      await Promise.allSettled([...this.pendingRetryOperations]);
    }

    logger.info('[RedisJobConsumer] Stopped.');
  }

  stop(): void {
    this.running = false;
  }

  async disconnect(): Promise<void> {
    this.stop();
    this.shuttingDown = true;
    this.resolveShutdownSignal?.();
    this.resolveShutdownSignal = null;

    await Promise.allSettled([
      this.blockingClient.quit(),
      this.commandClient.quit(),
    ]);
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
