import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics registry for the scraper microservice.
 * Exposes scrape performance and throughput metrics.
 */
export const registry = new Registry();

// Collect default Node.js metrics (heap, event loop lag, GC, etc.)
collectDefaultMetrics({ register: registry, prefix: 'ics_scraper_' });

// ---------------------------------------------------------------------------
// Business metrics
// ---------------------------------------------------------------------------

/** Total number of scrape jobs executed, labeled by status and trigger type. */
export const scrapeJobsTotal = new Counter({
  name: 'scrape_jobs_total',
  help: 'Total number of scrape jobs executed',
  labelNames: ['status', 'trigger'] as const,
  registers: [registry],
});

/** Scrape duration per cinema in seconds. */
export const scrapeDurationSeconds = new Histogram({
  name: 'scrape_duration_seconds',
  help: 'Duration of scrape operations per cinema in seconds',
  labelNames: ['cinema'] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

/** Total films scraped, labeled by cinema. */
export const filmsScrapedTotal = new Counter({
  name: 'films_scraped_total',
  help: 'Total number of films scraped',
  labelNames: ['cinema'] as const,
  registers: [registry],
});

/** Total showtimes scraped, labeled by cinema. */
export const showtimesScrapedTotal = new Counter({
  name: 'showtimes_scraped_total',
  help: 'Total number of showtimes scraped',
  labelNames: ['cinema'] as const,
  registers: [registry],
});

/** Redis queue depth gauge (updated periodically). */
export const redisQueueDepth = new Counter({
  name: 'redis_queue_depth_total',
  help: 'Total jobs popped from the Redis scrape queue',
  labelNames: [] as const,
  registers: [registry],
});
