import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis/built/redis/RedisOptions';
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
  private readonly redisUrl: string;
  private blockingClient: Redis;
  private commandClient: Redis;
  private running = false;
  private shuttingDown = false;
  private pendingRetryOperations = new Set<Promise<void>>();
  private pendingBackgroundOperations = new Set<Promise<void>>();
  private readonly shutdownSignal: Promise<void>;
  private resolveShutdownSignal: (() => void) | null = null;
  private reconnecting = false;
  private reconnectExhausted = false;
  private reconnectGate: Promise<boolean> | null = null;
  private resolveReconnectGate: ((connected: boolean) => void) | null = null;
  private readonly clientReady = {
    blocking: true,
    command: true,
  };
  private readonly reconnectAttempts = {
    blocking: 0,
    command: 0,
  };
  private activeJob: ScrapeJob | null = null;
  private pendingRecoveredJobs = new Map<string, ScrapeJob>();
  private pendingTerminalJobs = new Map<string, ScrapeJob>();
  private buildRecoveryJobCallback: ((job: ScrapeJob) => Promise<ScrapeJob>) | undefined;
  private onTerminalFailureCallback: ((job: ScrapeJob, failureReason: string) => Promise<void>) | undefined;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
    // Keep blocking queue reads isolated so retry/DLQ writes are not delayed by BLPOP.
    this.blockingClient = new Redis(redisUrl, this.createRedisOptions());
    this.commandClient = new Redis(redisUrl, this.createRedisOptions());
    this.bindClientLifecycle(this.blockingClient, 'blocking');
    this.bindClientLifecycle(this.commandClient, 'command');
    this.shutdownSignal = new Promise((resolve) => {
      this.resolveShutdownSignal = resolve;
    });
  }

  private createRedisOptions(): RedisOptions {
    return {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        if (times > MAX_SCRAPE_JOB_RETRY_ATTEMPTS) {
          return undefined;
        }

        return getScrapeJobRetryDelayMs(times);
      },
    };
  }

  private bindClientLifecycle(client: Redis, label: 'blocking' | 'command'): void {
    client.on('close', () => {
      this.handleConnectionClose(label);
    });
    client.on('reconnecting', (delay: number) => {
      this.handleConnectionReconnecting(label, delay);
    });
    client.on('ready', () => {
      this.handleConnectionReady(label);
    });
    client.on('end', () => {
      this.handleConnectionEnd(label);
    });
  }

  private trackBackgroundOperation(operation: Promise<void>): void {
    this.pendingBackgroundOperations.add(operation);
    void operation.finally(() => {
      this.pendingBackgroundOperations.delete(operation);
    });
  }

  private getJobTrackingId(job: ScrapeJob): string {
    return getDlqJobId(job);
  }

  private ensureReconnectGate(): Promise<boolean> {
    if (!this.reconnectGate) {
      this.reconnectGate = new Promise<boolean>((resolve) => {
        this.resolveReconnectGate = resolve;
      });
    }

    return this.reconnectGate;
  }

  private resolveCurrentReconnectGate(connected: boolean): void {
    this.resolveReconnectGate?.(connected);
    this.resolveReconnectGate = null;
    this.reconnectGate = null;
  }

  private areClientsReady(): boolean {
    return this.clientReady.blocking && this.clientReady.command;
  }

  private handleConnectionClose(label: 'blocking' | 'command'): void {
    if (this.shuttingDown) return;

    this.clientReady[label] = false;
    if (!this.reconnecting) {
      this.reconnecting = true;
      this.reconnectExhausted = false;
      this.ensureReconnectGate();
      logger.warn('[RedisJobConsumer] Redis connection interrupted', {
        client: label,
        active_job_id: this.activeJob ? this.getJobTrackingId(this.activeJob) : undefined,
      });
    }
  }

  private handleConnectionReconnecting(label: 'blocking' | 'command', delay: number): void {
    if (this.shuttingDown) return;

    this.handleConnectionClose(label);
    this.reconnectAttempts[label] += 1;
    logger.warn('[RedisJobConsumer] Attempting Redis reconnect', {
      client: label,
      retry_count: this.reconnectAttempts[label],
      retry_delay_ms: delay,
      active_job_id: this.activeJob ? this.getJobTrackingId(this.activeJob) : undefined,
    });
  }

  private handleConnectionReady(label: 'blocking' | 'command'): void {
    this.clientReady[label] = true;
    this.reconnectAttempts[label] = 0;

    if (!this.reconnecting || !this.areClientsReady()) {
      return;
    }

    this.reconnecting = false;
    this.reconnectExhausted = false;
    this.resolveCurrentReconnectGate(true);
    logger.info('[RedisJobConsumer] Redis connection restored', {
      resumed_job_count: this.pendingRecoveredJobs.size,
    });

    if (this.pendingRecoveredJobs.size > 0) {
      this.trackBackgroundOperation(this.resumeRecoveredJobs(this.buildRecoveryJobCallback));
    }
  }

  private handleConnectionEnd(label: 'blocking' | 'command'): void {
    if (this.shuttingDown || this.reconnectExhausted) return;

    this.clientReady[label] = false;
    this.reconnecting = false;
    this.reconnectExhausted = true;
    this.running = false;

    for (const [jobId, job] of this.pendingRecoveredJobs.entries()) {
      this.pendingTerminalJobs.set(jobId, job);
    }
    this.pendingRecoveredJobs.clear();

    this.resolveCurrentReconnectGate(false);
    logger.error('[RedisJobConsumer] Redis reconnect exhausted', {
      severity: 'critical',
      pending_terminal_jobs: this.pendingTerminalJobs.size + (this.activeJob ? 1 : 0),
      active_job_id: this.activeJob ? this.getJobTrackingId(this.activeJob) : undefined,
    });
  }

  private async waitForReconnectIfNeeded(): Promise<boolean> {
    if (!this.reconnectGate) {
      return !this.reconnectExhausted;
    }

    return await this.reconnectGate;
  }

  private isConnectionUnavailable(): boolean {
    return this.reconnecting
      || this.reconnectExhausted
      || !this.areClientsReady()
      || this.blockingClient.status !== 'ready'
      || this.commandClient.status !== 'ready';
  }

  private async buildRecoveryJob(job: ScrapeJob, buildRecoveryJob?: (job: ScrapeJob) => Promise<ScrapeJob>): Promise<ScrapeJob> {
    if (!buildRecoveryJob) {
      return job;
    }

    try {
      return await buildRecoveryJob(job);
    } catch (error) {
      logger.warn('[RedisJobConsumer] Failed to build reconnect recovery job, reusing original payload', {
        job_id: this.getJobTrackingId(job),
        error: error instanceof Error ? error.message : String(error),
      });
      return job;
    }
  }

  private stageRecoveryJob(job: ScrapeJob): void {
    this.pendingRecoveredJobs.set(this.getJobTrackingId(job), job);
    logger.warn('[RedisJobConsumer] Staged in-flight job for reconnect recovery', {
      job_id: this.getJobTrackingId(job),
      reportId: job.reportId,
      org_id: job.traceContext?.org_id,
    });
  }

  private async resumeRecoveredJobs(buildRecoveryJob?: (job: ScrapeJob) => Promise<ScrapeJob>): Promise<void> {
    const recoveredJobs = [...this.pendingRecoveredJobs.values()];

    for (const job of recoveredJobs) {
      if (this.reconnecting || this.reconnectExhausted || this.shuttingDown) {
        return;
      }

      const jobId = this.getJobTrackingId(job);
      const recoveryJob = await this.buildRecoveryJob(job, buildRecoveryJob);

      try {
        await this.commandClient.rpush(SCRAPE_JOBS_KEY, JSON.stringify(recoveryJob));
        this.pendingRecoveredJobs.delete(jobId);
        logger.warn('[RedisJobConsumer] Requeued recovered job after Redis reconnect', {
          job_id: jobId,
          reportId: recoveryJob.reportId,
          resume_mode: recoveryJob.type === 'scrape' ? recoveryJob.options?.resumeMode === true : false,
          org_id: recoveryJob.traceContext?.org_id,
        });
      } catch (error) {
        logger.error('[RedisJobConsumer] Failed to requeue recovered job after reconnect', {
          job_id: jobId,
          reportId: job.reportId,
          error: error instanceof Error ? error.message : String(error),
          org_id: job.traceContext?.org_id,
        });
        return;
      }
    }
  }

  private async persistTerminalFailureWithClient(entry: DlqJobEntry, client: Redis): Promise<void> {
    await client.zadd(SCRAPE_DLQ_KEY, Date.parse(entry.timestamp), JSON.stringify(entry));
    logger.warn('[RedisJobConsumer] Job moved to DLQ', {
      job_id: entry.job_id,
      reportId: entry.job.reportId,
      retry_count: entry.retry_count,
      timestamp: entry.timestamp,
      error: entry.failure_reason,
      org_id: entry.org_id,
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
        await this.persistTerminalFailureWithClient(entry, this.commandClient);
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

  private async persistReconnectExhaustedJobs(): Promise<void> {
    if (this.pendingTerminalJobs.size === 0) {
      return;
    }

    for (const [jobId, job] of this.pendingTerminalJobs.entries()) {
      const failureReason = 'Redis reconnect exhausted after 3 attempts';
      const entry = createDlqJobEntry({
        job,
        failureReason,
        retryCount: job.retryCount ?? 0,
      });

      if (this.onTerminalFailureCallback) {
        try {
          await this.onTerminalFailureCallback(job, failureReason);
        } catch (error) {
          logger.error('[RedisJobConsumer] Failed to record reconnect-exhausted job state', {
            severity: 'critical',
            job_id: entry.job_id,
            reportId: job.reportId,
            error: error instanceof Error ? error.message : String(error),
            org_id: job.traceContext?.org_id,
          });
        }
      }

      let persisted = false;

      for (let attempt = 1; attempt <= MAX_SCRAPE_JOB_RETRY_ATTEMPTS; attempt += 1) {
        try {
          if (this.commandClient.status === 'end') {
            await this.commandClient.connect();
          }

          await this.persistTerminalFailureWithClient(entry, this.commandClient);
          this.pendingTerminalJobs.delete(jobId);
          persisted = true;
          break;
        } catch (error) {
          logger.error('[RedisJobConsumer] Failed to persist reconnect-exhausted job to DLQ', {
            severity: 'critical',
            job_id: entry.job_id,
            reportId: job.reportId,
            retry_count: entry.retry_count,
            persistence_attempt: attempt,
            error: error instanceof Error ? error.message : String(error),
            org_id: job.traceContext?.org_id,
          });

          if (attempt < MAX_SCRAPE_JOB_RETRY_ATTEMPTS) {
            await this.sleep(getScrapeJobRetryDelayMs(attempt));
          }
        }
      }

      if (!persisted) {
        logger.error('[RedisJobConsumer] Unable to persist reconnect-exhausted job to DLQ', {
          severity: 'critical',
          job_id: entry.job_id,
          reportId: job.reportId,
          org_id: job.traceContext?.org_id,
        });
      }
    }
  }

  async start(
    handler: (job: ScrapeJob) => Promise<void>,
    options: {
      buildRecoveryJob?: (job: ScrapeJob) => Promise<ScrapeJob>;
      onTerminalFailure?: (job: ScrapeJob, failureReason: string) => Promise<void>;
    } = {}
  ): Promise<void> {
    this.running = true;
    this.buildRecoveryJobCallback = options.buildRecoveryJob;
    this.onTerminalFailureCallback = options.onTerminalFailure;
    logger.info('[RedisJobConsumer] Waiting for scrape jobs on scrape:jobs');

    while (this.running) {
      const canContinue = await this.waitForReconnectIfNeeded();
      if (!canContinue) {
        break;
      }

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
          this.activeJob = job;
          await handler(job);
        } catch (err) {
          await Promise.resolve();

          if (this.reconnectExhausted) {
            this.pendingTerminalJobs.set(this.getJobTrackingId(job), job);
            continue;
          }

          if (this.isConnectionUnavailable()) {
            this.stageRecoveryJob(job);
            continue;
          }

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

            if (this.onTerminalFailureCallback) {
              try {
                await this.onTerminalFailureCallback(entry.job, failureReason);
              } catch (callbackError) {
                logger.error('[RedisJobConsumer] Failed to record terminal job state', {
                  job_id: entry.job_id,
                  reportId: job.reportId,
                  error: callbackError instanceof Error ? callbackError.message : String(callbackError),
                  org_id: job.traceContext?.org_id,
                });
              }
            }

            await this.persistTerminalFailure(entry);
          } else {
              this.trackRetryOperation(
                this.requeueFailedJob(job, nextRetryCount, getScrapeJobRetryDelayMs(nextRetryCount), failureReason)
              );
            }
        } finally {
          this.activeJob = null;
        }
      } catch (err: any) {
        // If connection closed cleanly during shutdown, stop
        if (!this.running) break;

        if (this.reconnecting || this.reconnectExhausted) {
          continue;
        }

        logger.error('[RedisJobConsumer] Error polling queue', { err });
        // Brief pause to avoid tight loop on persistent errors
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (this.pendingRetryOperations.size > 0) {
      await Promise.allSettled([...this.pendingRetryOperations]);
    }

    if (this.pendingBackgroundOperations.size > 0) {
      await Promise.allSettled([...this.pendingBackgroundOperations]);
    }

    await this.persistReconnectExhaustedJobs();

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
