import dotenv from 'dotenv';
dotenv.config();

import { logger } from './utils/logger.js';
import { registry, scrapeJobsTotal, scrapeDurationSeconds, filmsScrapedTotal, showtimesScrapedTotal } from './utils/metrics.js';
import { initTracing } from './utils/tracer.js';

import { runScraper } from './scraper/index.js';
import { getRedisPublisher, getRedisConsumer, disconnectRedis, type ScrapeJob } from './redis/client.js';
import { db } from './db/client.js';
import { createScrapeReport, updateScrapeReport } from './db/queries.js';

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

async function executeJob(job: ScrapeJob): Promise<void> {
  const publisher = getRedisPublisher();

  // Update report status
  try {
    await updateScrapeReport(db, job.reportId, { status: 'running' });
  } catch (err) {
    logger.warn(`[scraper] Could not update report ${job.reportId}:`, err);
  }

  const startTime = Date.now();
  const durationTimer = scrapeDurationSeconds.startTimer({ cinema: 'all' });

  try {
    const summary = await runScraper(publisher, job.options);

    const status = summary.failed_cinemas === 0
      ? 'success'
      : summary.successful_cinemas > 0
        ? 'partial_success'
        : 'failed';

    durationTimer();
    scrapeJobsTotal.inc({ status, trigger: job.triggerType });
    filmsScrapedTotal.inc({ cinema: 'all' }, summary.total_films);
    showtimesScrapedTotal.inc({ cinema: 'all' }, summary.total_showtimes);

    await updateScrapeReport(db, job.reportId, {
      status,
      completed_at: new Date().toISOString(),
      total_cinemas: summary.total_cinemas,
      successful_cinemas: summary.successful_cinemas,
      failed_cinemas: summary.failed_cinemas,
      total_films_scraped: summary.total_films,
      total_showtimes_scraped: summary.total_showtimes,
      errors: summary.errors,
    });

    logger.info(`[scraper] Job ${job.reportId} completed with status: ${status}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`[scraper] Job ${job.reportId} failed:`, err);
    scrapeJobsTotal.inc({ status: 'failed', trigger: job.triggerType });

    await updateScrapeReport(db, job.reportId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [{ cinema_name: 'System', error: errorMessage }],
    }).catch(() => {});
  }
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
    logger.info(`[scraper] Processing job: reportId=${job.reportId}`);
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
    await executeJob(job);
  });
}

// ---------------------------------------------------------------------------
// Cron mode: scheduled scraping (no Redis)
// ---------------------------------------------------------------------------

async function runCron(): Promise<void> {
  const cronSchedule = process.env.CRON_SCHEDULE ?? '0 6 * * *'; // Default: 6 AM daily
  logger.info(`[scraper] Mode: cron, schedule: ${cronSchedule}`);

  const { default: cron } = await import('node-cron');

  if (!cron.validate(cronSchedule)) {
    throw new Error(`Invalid cron schedule: ${cronSchedule}`);
  }

  const task = cron.schedule(cronSchedule, async () => {
    logger.info('[scraper] Cron triggered, starting scrape...');

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

      logger.info(`[scraper] Cron scrape completed: ${status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[scraper] Cron scrape failed:', err);
      await updateScrapeReport(db, reportId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ cinema_name: 'System', error: errorMessage }],
      }).catch(() => {});
    }
  });

  logger.info('[scraper] Cron task scheduled. Waiting...');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('[scraper] SIGTERM received, stopping cron...');
    task.stop();
    await disconnectRedis();
    await db.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('[scraper] SIGINT received, stopping cron...');
    task.stop();
    await disconnectRedis();
    await db.end();
    process.exit(0);
  });
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
