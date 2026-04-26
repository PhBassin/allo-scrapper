import Redis from 'ioredis';
import {
  createDlqJobEntry,
  getDlqJobId,
  getScrapeJobRetryDelayMs,
  matchesDlqOrg,
  MAX_SCRAPE_JOB_RETRY_ATTEMPTS,
  resetDlqJobForRetry,
  SCRAPE_DLQ_KEY,
  SCRAPE_JOBS_KEY,
  type DlqJobEntry,
  type ScrapeJob,
  type ScrapeJobAddCinema,
  type ScrapeTraceContext,
} from '@allo-scrapper/logger';
import type { ProgressEvent } from './progress-tracker.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DlqJobListResult {
  jobs: DlqJobEntry[];
  total: number;
  page: number;
  pageSize: number;
}

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

export type { DlqJobEntry, ScrapeJob };

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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async publishWithRetry(job: ScrapeJob): Promise<number> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_SCRAPE_JOB_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.publisher.rpush(SCRAPE_JOBS_KEY, JSON.stringify(job));
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.warn('[RedisClient] Failed to enqueue scrape job', {
          job_id: getDlqJobId(job),
          report_id: job.reportId,
          retry_count: attempt,
          timestamp: new Date().toISOString(),
          error: errorMessage,
        });

        if (attempt >= MAX_SCRAPE_JOB_RETRY_ATTEMPTS) {
          await this.moveJobToDlq({
            job: {
              ...job,
              retryCount: attempt,
            },
            failureReason: errorMessage,
            retryCount: attempt,
          });

          logger.error('[RedisClient] Job moved to DLQ after enqueue retries exhausted', {
            job_id: getDlqJobId(job),
            report_id: job.reportId,
            retry_count: attempt,
            timestamp: new Date().toISOString(),
            error: errorMessage,
          });
          throw error;
        }

        await this.sleep(getScrapeJobRetryDelayMs(attempt));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** Push a scrape job onto the queue. Returns the new queue length. */
  async publishJob(job: ScrapeJob): Promise<number> {
    return this.publishWithRetry(job);
  }

  /** Push an add_cinema job onto the queue. Returns the new queue length. */
  async publishAddCinemaJob(reportId: number, url: string, traceContext?: ScrapeTraceContext): Promise<number> {
    const job: ScrapeJobAddCinema = { type: 'add_cinema', triggerType: 'manual', reportId, url, ...(traceContext && { traceContext }) };
    return this.publishWithRetry(job);
  }

  /** Return the current depth of the scrape:jobs queue. */
  async getQueueDepth(): Promise<number> {
    return this.publisher.llen(SCRAPE_JOBS_KEY);
  }

  async moveJobToDlq({
    job,
    failureReason,
    retryCount,
    timestamp = new Date().toISOString(),
  }: {
    job: ScrapeJob;
    failureReason: string;
    retryCount: number;
    timestamp?: string;
  }): Promise<DlqJobEntry> {
    const entry = createDlqJobEntry({ job, failureReason, retryCount, timestamp });

    await this.publisher.zadd(SCRAPE_DLQ_KEY, Date.parse(timestamp), JSON.stringify(entry));
    return entry;
  }

  async listDlqJobs(pageSize: number = 50, page: number = 1, orgId?: number): Promise<DlqJobListResult> {
    const normalizedPageSize = Math.max(1, Math.min(pageSize, 50));
    const normalizedPage = Math.max(1, page);

    const [items, total] = await Promise.all([
      this.publisher.zrevrange(SCRAPE_DLQ_KEY, 0, -1),
      this.publisher.zcard(SCRAPE_DLQ_KEY),
    ]);

    const parsedJobs = items.flatMap((item: string) => {
      try {
        return [JSON.parse(item) as DlqJobEntry];
      } catch (error) {
        logger.error('[RedisClient] Failed to parse DLQ entry', { error, item });
        return [];
      }
    });

    const filteredJobs = parsedJobs.filter((entry) => matchesDlqOrg(entry, orgId));
    const start = (normalizedPage - 1) * normalizedPageSize;
    const jobs = filteredJobs.slice(start, start + normalizedPageSize);

    return {
      jobs,
      total: orgId === undefined ? total : filteredJobs.length,
      page: normalizedPage,
      pageSize: normalizedPageSize,
    };
  }

  async getDlqJobById(jobId: string, orgId?: number): Promise<DlqJobEntry | null> {
    const entries = await this.publisher.zrevrange(SCRAPE_DLQ_KEY, 0, -1);
    for (const item of entries) {
      try {
        const entry = JSON.parse(item) as DlqJobEntry;
        if (entry.job_id === jobId && matchesDlqOrg(entry, orgId)) {
          return entry;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async retryDlqJob(jobId: string, orgId?: number): Promise<DlqJobEntry | null> {
    const entries = await this.publisher.zrevrange(SCRAPE_DLQ_KEY, 0, -1);
    const rawEntry = entries.find((item: string) => {
      try {
        const entry = JSON.parse(item) as DlqJobEntry;
        return entry.job_id === jobId && matchesDlqOrg(entry, orgId);
      } catch {
        return false;
      }
    });

    if (!rawEntry) {
      return null;
    }

    const entry = JSON.parse(rawEntry) as DlqJobEntry;
    const retriedEntry = resetDlqJobForRetry(entry);
    await this.publisher.rpush(SCRAPE_JOBS_KEY, JSON.stringify(retriedEntry.job));
    await this.publisher.zrem(SCRAPE_DLQ_KEY, rawEntry);

    return retriedEntry;
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
    logger.info('[RedisClient] Subscribed to scrape:progress');

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel !== 'scrape:progress') return;
      try {
        const event: ProgressEvent = JSON.parse(message);
        logger.info('[RedisClient] Received progress event', {
          type: event.type,
          report_id: event.report_id,
        });
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
