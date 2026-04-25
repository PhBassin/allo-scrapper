import dotenv from 'dotenv';
dotenv.config();

import { logger } from './utils/logger.js';
import { registry, scrapeJobsTotal, scrapeDurationSeconds, filmsScrapedTotal, showtimesScrapedTotal } from './utils/metrics.js';
import { initTracing } from './utils/tracer.js';
import type { ScrapeJobAddCinema, ScrapeJobScrape } from '@allo-scrapper/logger';

import { runScraper, addCinemaAndScrape } from './scraper/index.js';
import { getRedisPublisher, getRedisConsumer, getRedisSubscriber, disconnectRedis, type ScrapeJob, type ScheduleChangeEvent } from './redis/client.js';
import { db, withTenantDb } from './db/client.js';
import { createScrapeReport, updateScrapeReport } from './db/report-queries.js';
import { getPendingScrapeAttempts, getScrapeAttemptsByReport } from './db/scrape-attempt-queries.js';
import { getEnabledSchedules, updateScheduleRunStatus } from './db/schedule-queries.js';
import { getCinemas } from './db/cinema-queries.js';
import { getScrapeDates, type ScrapeMode } from './utils/date.js';

// ---------------------------------------------------------------------------
// Metrics HTTP server (always-on, port 9091)
// ---------------------------------------------------------------------------

const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? '9091', 10);

async function startMetricsServer(): Promise<void> {
  const { default: express } = await import('express');
  const metricsApp = express();

  metricsApp.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      res.status(500).end(String(err));
    }
  });

  metricsApp.listen(METRICS_PORT, () => {
    logger.info(`Metrics server listening on port ${METRICS_PORT}`);
  });
}


// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

/**
 * RUN_MODE controls how this container behaves:
 *  - "oneshot"  : Pop one job from Redis queue, execute it, then exit. (default)
 *  - "consumer" : Long-running process that polls Redis queue continuously.
 *  - "cron"     : Run scraper on a schedule (no Redis, uses CRON_SCHEDULE env).
 *  - "direct"   : Run scraper immediately once and exit (for local dev / manual use).
 */
type RunMode = 'oneshot' | 'consumer' | 'cron' | 'direct';

const RUN_MODE: RunMode = (process.env.RUN_MODE as RunMode) ?? 'oneshot';

// ---------------------------------------------------------------------------
// Job executor
// ---------------------------------------------------------------------------

interface ExecuteJobOptions {
  rethrowOnFailure?: boolean;
  skipReportFailureUpdate?: boolean;
}

export async function executeJob(job: ScrapeJob, options: ExecuteJobOptions = {}): Promise<void> {
  const publisher = getRedisPublisher();
  const { rethrowOnFailure = false, skipReportFailureUpdate = false } = options;
  // Support legacy jobs that predate the discriminated union (no 'type' field)
  const jobType = ('type' in job) ? job.type : 'scrape';

  const traceLogContext = {
    org_id: job.traceContext?.org_id,
    org_slug: job.traceContext?.org_slug,
    user_id: job.traceContext?.user_id,
    endpoint: job.traceContext?.endpoint,
    method: job.traceContext?.method,
    traceparent: job.traceContext?.traceparent,
  };

  await withTenantDb(job.traceContext?.org_slug, async (jobDb) => {
    // Update report status
    try {
      await updateScrapeReport(jobDb, job.reportId, { status: 'running' });
    } catch (err) {
      logger.warn(`[scraper] Could not update report ${job.reportId}:`, err);
    }

    // --- add_cinema branch ---
    if (jobType === 'add_cinema') {
      const addCinemaJob = job as ScrapeJobAddCinema;
      try {
        await addCinemaAndScrape(jobDb, addCinemaJob.url, publisher);
        await updateScrapeReport(jobDb, job.reportId, {
          status: 'success',
          completed_at: new Date().toISOString(),
        });
        logger.info(`[scraper] add_cinema job ${job.reportId} completed successfully`, traceLogContext);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`[scraper] add_cinema job ${job.reportId} failed`, {
          ...traceLogContext,
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });
        if (!skipReportFailureUpdate) {
          await updateScrapeReport(jobDb, job.reportId, {
            status: 'failed',
            completed_at: new Date().toISOString(),
            errors: [{ cinema_name: 'System', error: errorMessage }],
          }).catch(() => {});
        }

        if (rethrowOnFailure) {
          throw err;
        }
      }
      return;
    }

    // --- scrape branch ---
    const durationTimer = scrapeDurationSeconds.startTimer({ cinema: 'all' });

    try {
      const scrapeJob = job as ScrapeJobScrape;
      const summary = await runScraper(publisher, {
        reportId: job.reportId,
        ...scrapeJob.options,
        traceContext: job.traceContext,
      }, jobDb);

      const status = summary.failed_cinemas === 0
        ? 'success'
        : summary.successful_cinemas > 0
          ? 'partial_success'
          : 'failed';

      durationTimer();
      scrapeJobsTotal.inc({ status, trigger: job.triggerType });
      filmsScrapedTotal.inc({ cinema: 'all' }, summary.total_films);
      showtimesScrapedTotal.inc({ cinema: 'all' }, summary.total_showtimes);

      await updateScrapeReport(jobDb, job.reportId, {
        status,
        completed_at: new Date().toISOString(),
        total_cinemas: summary.total_cinemas,
        successful_cinemas: summary.successful_cinemas,
        failed_cinemas: summary.failed_cinemas,
        total_films_scraped: summary.total_films,
        total_showtimes_scraped: summary.total_showtimes,
        errors: summary.errors,
      });

      logger.info(`[scraper] Job ${job.reportId} completed with status: ${status}`, traceLogContext);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`[scraper] Job ${job.reportId} failed`, {
        ...traceLogContext,
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      });
      scrapeJobsTotal.inc({ status: 'failed', trigger: job.triggerType });

      if (!skipReportFailureUpdate) {
        await updateScrapeReport(jobDb, job.reportId, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ cinema_name: 'System', error: errorMessage }],
        }).catch(() => {});
      }

      if (rethrowOnFailure) {
        throw err;
      }
    }
  });
}

async function getRecoveryPendingAttempts(jobDb: typeof db, job: ScrapeJobScrape): Promise<Array<{ cinema_id: string; date: string }>> {
  const pendingAttempts = await getPendingScrapeAttempts(jobDb, job.reportId);
  if (pendingAttempts.length > 0) {
    return pendingAttempts.map((attempt) => ({
      cinema_id: attempt.cinema_id,
      date: attempt.date,
    }));
  }

  const existingAttempts = await getScrapeAttemptsByReport(jobDb, job.reportId);
  if (existingAttempts.length === 0) {
    return [];
  }

  const successfulAttemptKeys = new Set(
    existingAttempts
      .filter((attempt) => attempt.status === 'success')
      .map((attempt) => `${attempt.cinema_id}:${attempt.date}`)
  );

  let cinemas = await getCinemas(jobDb);
  if (job.options?.cinemaId) {
    cinemas = cinemas.filter((cinema) => cinema.id === job.options?.cinemaId);
  }

  let scrapeMode: ScrapeMode = 'from_today_limited';
  let scrapeDays = 7;
  try {
      const settingsResult = await jobDb.query<{ scrape_mode: string; scrape_days: number }>(
        'SELECT scrape_mode, scrape_days FROM app_settings WHERE id = 1'
      );
    if (settingsResult.rows.length > 0) {
      scrapeMode = settingsResult.rows[0].scrape_mode as ScrapeMode;
      scrapeDays = settingsResult.rows[0].scrape_days;
    }
  } catch (error) {
    logger.warn('[scraper] Could not read scrape settings for recovery checkpoint', {
      reportId: job.reportId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (job.options?.mode) scrapeMode = job.options.mode;
  if (job.options?.days) scrapeDays = job.options.days;

  const dates = getScrapeDates(scrapeMode, scrapeDays);

  return cinemas.flatMap((cinema) => dates
    .filter((date) => !successfulAttemptKeys.has(`${cinema.id}:${date}`))
    .map((date) => ({
      cinema_id: cinema.id,
      date,
    }))
  );
}

export async function buildRecoveryJob(job: ScrapeJob): Promise<ScrapeJob> {
  if (job.type !== 'scrape' || job.options?.resumeMode) {
    return job;
  }

  const pendingAttempts = await withTenantDb(job.traceContext?.org_slug, async (jobDb) => {
    return await getRecoveryPendingAttempts(jobDb, job);
  });
  if (pendingAttempts.length === 0) {
    return job;
  }

  return {
    ...job,
    options: {
      ...job.options,
      resumeMode: true,
      pendingAttempts: pendingAttempts.map((attempt) => ({
        cinema_id: attempt.cinema_id,
        date: attempt.date,
      })),
    },
  };
}

export async function recordTerminalJobFailure(job: ScrapeJob, failureReason: string): Promise<void> {
  await withTenantDb(job.traceContext?.org_slug, async (jobDb) => {
    await updateScrapeReport(jobDb, job.reportId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [{ cinema_name: 'System', error: failureReason }],
    });
  });
}

// ---------------------------------------------------------------------------
// Oneshot mode: pop one job and exit
// ---------------------------------------------------------------------------

async function runOneshot(): Promise<void> {
  logger.info('[scraper] Mode: oneshot');
  const consumer = getRedisConsumer();

  // Use a non-blocking pop (LPOP) for oneshot
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  try {
    const raw = await redis.lpop('scrape:jobs');
    if (!raw) {
      logger.info('[scraper] No job in queue. Exiting.');
      return;
    }

    const job: ScrapeJob = JSON.parse(raw);
    logger.info('[scraper] Processing job', {
      report_id: job.reportId,
      org_id: job.traceContext?.org_id,
      org_slug: job.traceContext?.org_slug,
      user_id: job.traceContext?.user_id,
      endpoint: job.traceContext?.endpoint,
      method: job.traceContext?.method,
    });
    await executeJob(job);
  } finally {
    await redis.quit();
    await disconnectRedis();
    await db.end();
  }
}

// ---------------------------------------------------------------------------
// Consumer mode: long-running queue consumer
// ---------------------------------------------------------------------------

async function runConsumer(): Promise<void> {
  logger.info('[scraper] Mode: consumer (long-running)');
  const consumer = getRedisConsumer();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('[scraper] SIGTERM received, shutting down...');
    consumer.stop();
    await disconnectRedis();
    await db.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('[scraper] SIGINT received, shutting down...');
    consumer.stop();
    await disconnectRedis();
    await db.end();
    process.exit(0);
  });

  await consumer.start(async (job) => {
    await executeJob(job, { rethrowOnFailure: true, skipReportFailureUpdate: true });
  }, {
    buildRecoveryJob,
    onTerminalFailure: recordTerminalJobFailure,
  });
}

// ---------------------------------------------------------------------------
// Cron mode: scheduled scraping with dynamic reload
// ---------------------------------------------------------------------------

async function runCron(): Promise<void> {
  const cronModule = await import('node-cron');
  const cron = cronModule.default;

  interface ScheduleTask {
    id: number;
    name: string;
    cron_expression: string;
    task: ReturnType<typeof cron.schedule>;
  }

  const activeTasks = new Map<number, ScheduleTask>();

  async function executeSchedule(schedule: { id?: number; name: string; cron_expression: string }): Promise<void> {
    logger.info(`[scraper] Cron triggered for "${schedule.name}", starting scrape...`);

    let reportId: number;
    try {
      reportId = await createScrapeReport(db, 'cron');
    } catch (err) {
      logger.error('[scraper] Failed to create scrape report:', err);
      return;
    }

    const publisher = getRedisPublisher();

    try {
      const summary = await runScraper(publisher);

      const status = summary.failed_cinemas === 0
        ? 'success'
        : summary.successful_cinemas > 0
          ? 'partial_success'
          : 'failed';

      await updateScrapeReport(db, reportId, {
        status,
        completed_at: new Date().toISOString(),
        total_cinemas: summary.total_cinemas,
        successful_cinemas: summary.successful_cinemas,
        failed_cinemas: summary.failed_cinemas,
        total_films_scraped: summary.total_films,
        total_showtimes_scraped: summary.total_showtimes,
        errors: summary.errors,
      });

      if (schedule.id) {
        await updateScheduleRunStatus(db, schedule.id, status);
      }

      logger.info(`[scraper] Cron scrape for "${schedule.name}" completed: ${status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`[scraper] Cron scrape for "${schedule.name}" failed:`, err);
      await updateScrapeReport(db, reportId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ cinema_name: 'System', error: errorMessage }],
      }).catch(() => {});

      if (schedule.id) {
        await updateScheduleRunStatus(db, schedule.id, 'failed').catch(() => {});
      }
    }
  }

  function scheduleTask(schedule: { id: number; name: string; cron_expression: string }): ScheduleTask | null {
    if (!cron.validate(schedule.cron_expression)) {
      logger.error(`[scraper] Invalid cron expression for "${schedule.name}": ${schedule.cron_expression}`);
      return null;
    }

    logger.info(`[scraper] Scheduling "${schedule.name}" with cron: ${schedule.cron_expression}`);

    const task = cron.schedule(schedule.cron_expression, () => {
      executeSchedule(schedule);
    });

    return { ...schedule, task };
  }

  async function handleScheduleChange(event: ScheduleChangeEvent): Promise<void> {
    const { action, scheduleId, schedule } = event;

    logger.info(`[scraper] Received schedule change event: ${action} for schedule ${scheduleId}`);

    switch (action) {
      case 'created':
        if (schedule && schedule.enabled !== false) {
          const task = scheduleTask(schedule);
          if (task) {
            activeTasks.set(scheduleId, task);
            logger.info(`[scraper] Added new schedule task: "${schedule.name}" (id=${scheduleId})`);
          }
        }
        break;

      case 'updated':
        activeTasks.get(scheduleId)?.task.stop();
        activeTasks.delete(scheduleId);
        if (schedule && schedule.enabled !== false) {
          const task = scheduleTask(schedule);
          if (task) {
            activeTasks.set(scheduleId, task);
            logger.info(`[scraper] Updated schedule task: "${schedule.name}" (id=${scheduleId})`);
          }
        } else {
          logger.info(`[scraper] Schedule ${scheduleId} is disabled, not scheduling`);
        }
        break;

      case 'deleted':
        activeTasks.get(scheduleId)?.task.stop();
        activeTasks.delete(scheduleId);
        logger.info(`[scraper] Removed schedule task: id=${scheduleId}`);
        break;
    }
  }

  async function subscribeToScheduleChanges(): Promise<void> {
    const subscriber = getRedisSubscriber();
    await subscriber.subscribe('scraper:schedule:changed', handleScheduleChange);
  }

  async function loadInitialSchedules(): Promise<void> {
    try {
      const schedules = await getEnabledSchedules(db);
      for (const schedule of schedules) {
        const task = scheduleTask(schedule);
        if (task) {
          activeTasks.set(schedule.id, task);
        }
      }
      logger.info(`[scraper] Loaded ${activeTasks.size} schedule(s) from database`);
    } catch (err) {
      logger.warn('[scraper] Failed to load schedules from database:', err);
    }
  }

  await loadInitialSchedules();
  await subscribeToScheduleChanges();

  logger.info(`[scraper] ${activeTasks.size} cron task(s) scheduled. Listening for schedule changes...`);

  async function shutdown(): Promise<void> {
    logger.info('[scraper] Shutting down cron mode...');
    for (const task of activeTasks.values()) {
      task.task.stop();
    }
    await disconnectRedis();
    await db.end();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// ---------------------------------------------------------------------------
// Direct mode: run once immediately and exit
// ---------------------------------------------------------------------------

async function runDirect(): Promise<void> {
  logger.info('[scraper] Mode: direct (immediate one-time run)');

  let reportId: number;
  try {
    reportId = await createScrapeReport(db, 'manual');
  } catch (err) {
    logger.error('[scraper] Failed to create scrape report:', err);
    reportId = -1;
  }

  try {
    const publisher = getRedisPublisher();
    const summary = await runScraper(publisher);

    if (reportId !== -1) {
      const status = summary.failed_cinemas === 0
        ? 'success'
        : summary.successful_cinemas > 0
          ? 'partial_success'
          : 'failed';

      await updateScrapeReport(db, reportId, {
        status,
        completed_at: new Date().toISOString(),
        total_cinemas: summary.total_cinemas,
        successful_cinemas: summary.successful_cinemas,
        failed_cinemas: summary.failed_cinemas,
        total_films_scraped: summary.total_films,
        total_showtimes_scraped: summary.total_showtimes,
        errors: summary.errors,
      });
    }

    logger.info('[scraper] Direct run completed.');
  } finally {
    await disconnectRedis();
    await db.end();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info(`[scraper] Starting in ${RUN_MODE} mode...`);

  // Initialise distributed tracing (OTLP → Tempo)
  initTracing();

  // Start metrics HTTP endpoint (non-blocking)
  await startMetricsServer();

  switch (RUN_MODE) {
    case 'oneshot':
      await runOneshot();
      break;
    case 'consumer':
      await runConsumer();
      break;
    case 'cron':
      await runCron();
      break;
    case 'direct':
      await runDirect();
      break;
    default:
      throw new Error(`Unknown RUN_MODE: ${RUN_MODE}`);
  }
}

main().catch((err) => {
  logger.error('[scraper] Fatal error:', err);
  process.exit(1);
});
