import { db, type DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  getTheaterConfigs,
  getTheaters,
} from '../db/theater-queries.js';
import { closeBrowser, delay } from './http-client.js';
import { getScrapeDates, type ScrapeMode } from '../utils/date.js';
import type { TheaterConfig, Theater, ProgressEvent, ScrapeSummary } from '../types/scraper.js';
import { getStrategyByUrl, getStrategyBySource } from './strategy-factory.js';
import { RateLimitError } from '../utils/errors.js';
import { classifyError } from '../utils/error-classifier.js';
import {
  createScrapeAttempt,
  updateScrapeAttempt,
} from '../db/scrape-attempt-queries.js';

/**
 * Mutable context shared across the runScraper orchestration steps.
 * Bundles the dependencies the per-step helpers need so the call sites
 * stay short and the helpers stay individually testable.
 *
 * Intentionally NOT exported: this is an internal contract between the
 * helpers in this file. External callers should use runScraper.
 */
interface ScrapeContext {
  db: DB;
  summary: ScrapeSummary;
  progress?: ProgressPublisher;
  movieDelayMs: number;
  theaterDelayMs: number;
}

/**
 * Result of prepareSchedule: which theaters to scrape, on which dates.
 *
 * Named PrepareScheduleResult (not ScrapeSchedule) to avoid collision
 * with the ScrapeSchedule DB row type exported by
 * ../db/schedule-queries.ts. They mean very different things.
 */
export interface PrepareScheduleResult {
  theaters: TheaterConfig[];
  dates: string[];
  scrapeMode: ScrapeMode;
  scrapeDays: number;
}

/** Per-theater outcome reported back to runScraper. */
interface ScrapeTheaterResult {
  /** True if a 429 was hit: the caller should stop processing further theaters. */
  rateLimited: boolean;
  /** The dates effectively attempted for this theater (filtered by availableDates). */
  datesToScrape: string[];
  successfulDates: number;
  moviesCount: number;
  showtimesCount: number;
}

// Progress publisher interface – allows injecting Redis publisher or a no-op
export interface ProgressPublisher {
  emit(event: ProgressEvent): Promise<void>;
}

// No-op publisher for standalone use
class NoopProgressPublisher implements ProgressPublisher {
  async emit(_event: ProgressEvent): Promise<void> {}
}

/**
 * Backward compatibility wrapper for loadTheaterMetadata.
 * Delegates to the appropriate strategy based on the theater URL.
 */
export async function loadTheaterMetadata(
  db: DB,
  theater: TheaterConfig
): Promise<{ availableDates: string[]; theater: Theater }> {
  const strategy = getStrategyBySource(theater.source || 'allocine');
  return strategy.loadTheaterMetadata(db, theater);
}

/**
 * Scraper un theater pour une date donnée (backward compatibility wrapper).
 */
async function scrapeTheater(
  db: DB,
  theater: TheaterConfig,
  date: string,
  movieDelayMs: number,
  progress?: ProgressPublisher
): Promise<{ moviesCount: number; showtimesCount: number }> {
  const strategy = getStrategyBySource(theater.source || 'allocine');
  return strategy.scrapeTheater(db, theater, date, movieDelayMs, progress);
}

/**
 * Add a new theater by URL and scrape all available showtimes for it.
 * Resolves the appropriate strategy from the URL, extracts metadata,
 * then scrapes every available date.
 */
export async function addTheaterAndScrape(
  db: DB,
  url: string,
  progress?: ProgressPublisher
): Promise<Theater> {
  const strategy = getStrategyByUrl(url);
  
  const theaterId = strategy.extractTheaterId(url);
  if (!theaterId) {
    throw new Error(`Could not extract theater ID from URL: ${url}`);
  }

  const cleanedUrl = strategy.cleanTheaterUrl(url);
  const tempConfig: TheaterConfig = { 
    id: theaterId, 
    name: theaterId, 
    url: cleanedUrl,
    source: strategy.sourceName 
  };

  logger.info(`Adding new theater from ${url} using ${strategy.sourceName} strategy...`);
  const { availableDates, theater } = await strategy.loadTheaterMetadata(db, tempConfig);

  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  logger.info(`Scraping ${availableDates.length} available date(s)...`, { theater: theater.name });

  for (const date of availableDates) {
    try {
      await strategy.scrapeTheater(db, tempConfig, date, movieDelayMs, progress);
    } catch (error) {
      logger.error('Failed to scrape date', { date, theater: theater.name, error });
    }
  }

  await closeBrowser();
  logger.info('Theater added successfully', { theater: theater.name, id: theater.id });

  return theater;
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
  theaterId?: string;
  movieId?: number;
  reportId?: number;  // For tracking attempts in database
  resumeMode?: boolean;  // Skip already-successful attempts
  pendingAttempts?: Array<{ theater_id: string; date: string }>;  // For resume mode
}

/**
 * Load the list of theaters and the list of dates the current run will scrape.
 *
 * Responsibilities:
 *  - Read configured theaters from the database.
 *  - If `options.theaterId` is provided, narrow the list to that single
 *    theater after verifying it exists in the database AND is configured
 *    for scraping (two distinct error messages to ease diagnosis).
 *  - Resolve the scrape mode / day count from options or environment.
 *  - Materialize the concrete list of dates via getScrapeDates.
 *  - Emit the `started` progress event and update summary totals.
 *
 * The function performs no network I/O beyond the two DB reads. All HTTP
 * work happens later, inside scrapeTheaterWithStrategy.
 */
export async function prepareSchedule(
  ctx: ScrapeContext,
  options?: ScrapeOptions
): Promise<PrepareScheduleResult> {
  let theaters = await getTheaterConfigs(ctx.db);

  // Filter to a single theater if requested
  if (options?.theaterId) {
    // The database is the source of truth for "does this theater exist?"
    const allTheatersFromDb = await getTheaters(ctx.db);
    const theaterExistsInDb = allTheatersFromDb.some(
      (c: Theater) => c.id === options.theaterId
    );

    if (!theaterExistsInDb) {
      throw new Error(`Theater not found in database: ${options.theaterId}`);
    }

    // Then check that it is actually configured for scraping
    const foundTheater = theaters.find(c => c.id === options.theaterId);
    if (!foundTheater) {
      throw new Error(`Theater not configured for scraping: ${options.theaterId}`);
    }

    theaters = [foundTheater];
    logger.info(`Scraping only theater: ${foundTheater.name} (${foundTheater.id})`);
  }

  logger.info('Theaters loaded', { count: theaters.length });

  const scrapeMode =
    options?.mode ?? (process.env.SCRAPE_MODE as ScrapeMode) ?? 'from_today_limited';
  const scrapeDays = options?.days || parseInt(process.env.SCRAPE_DAYS || '7', 10);
  const dates = getScrapeDates(scrapeMode, scrapeDays);

  logger.info('Scrape config', { mode: scrapeMode, dates: dates.length, scrapeDays });
  logger.info('Delay config', {
    theaterDelayMs: ctx.theaterDelayMs,
    movieDelayMs: ctx.movieDelayMs,
  });

  ctx.summary.total_theaters = theaters.length;
  ctx.summary.total_dates = dates.length;

  await ctx.progress?.emit({
    type: 'started',
    total_theaters: theaters.length,
    total_dates: dates.length,
  });

  return { theaters, dates, scrapeMode, scrapeDays };
}

/**
 * Mark a theater/date attempt as 'not_attempted'. Errors are logged and
 * swallowed because failure here must not abort the rest of the run.
 */
async function markNotAttempted(
  ctx: ScrapeContext,
  reportId: number,
  theaterId: string,
  date: string
): Promise<void> {
  try {
    await createScrapeAttempt(ctx.db, {
      report_id: reportId,
      theater_id: theaterId,
      date,
      status: 'not_attempted',
    });
  } catch (error) {
    logger.error('Failed to mark attempt as not_attempted', { error });
  }
}

/**
 * Orchestrate the scraping of a single theater.
 *
 * Responsibilities (kept tightly scoped to one theater):
 *  - Resolve the right strategy from the theater source.
 *  - Emit `theater_started`.
 *  - Load metadata (errors here count the theater as failed and short-circuit).
 *  - Filter the global `dates` list down to the dates the theater has
 *    actually published, with optional resume-mode narrowing.
 *  - For each date, create a 'pending' scrape attempt (if reportId given),
 *    call strategy.scrapeTheater, and update the attempt to success/failed.
 *  - On RateLimitError, mark THIS theater's remaining dates as not_attempted
 *    and signal back to the caller via `rateLimited: true` so the outer
 *    loop can stop processing further theaters.
 *  - On any other date error, log + record + continue with the next date.
 *  - At the end, fold the per-theater counts into the shared summary
 *    (successful_theaters vs failed_theaters) and emit `theater_completed`.
 *
 * Returns a ScrapeTheaterResult that lets runScraper coordinate
 * inter-theater concerns (theater-to-theater delay, cascading
 * not_attempted for remaining theaters, the outer `rateLimited` break).
 */
export async function scrapeTheaterWithStrategy(
  theater: TheaterConfig,
  dates: string[],
  ctx: ScrapeContext,
  options?: ScrapeOptions,
  // Optional context for cascading not_attempted writes to the remaining
  // theaters when this theater hits a rate limit. When omitted, only the
  // current theater's remaining dates are marked not_attempted (legacy
  // behaviour preserved for callers that don't need the cascade).
  cascade?: {
    allTheaters: TheaterConfig[];
    theaterIndex: number;
    /** Dates that were intersected with availableDates (i.e. "what we would have scraped"). */
    datesToScrape: string[];
  }
): Promise<ScrapeTheaterResult> {
  const strategy = getStrategyBySource(theater.source || 'allocine');
  const summary = ctx.summary;
  const movieDelayMs = ctx.movieDelayMs;
  const progress = ctx.progress;

  let theaterMoviesCount = 0;
  let theaterShowtimesCount = 0;
  let successfulDates = 0;
  let rateLimited = false;

  // Load the list of dates this theater has actually published.
  const { availableDates, failed } = await loadTheaterAvailability(ctx, theater);
  if (failed) {
    return {
      rateLimited: false,
      datesToScrape: [],
      successfulDates: 0,
      moviesCount: 0,
      showtimesCount: 0,
    };
  }

  const { datesToScrape, finalDatesToScrape } = filterDatesForScrape(
    theater,
    dates,
    availableDates,
    options ?? {}
  );

  logger.info('Dates to scrape', { theater: theater.name, count: finalDatesToScrape.length });

  for (const date of finalDatesToScrape) {
    logger.info('Attempting date', { theater: theater.name, date });

    // Track attempt in database if reportId provided
    let attemptId: number | undefined;
    if (options?.reportId) {
      try {
        attemptId = await createScrapeAttempt(ctx.db, {
          report_id: options.reportId,
          theater_id: theater.id,
          date,
          status: 'pending',
        });
      } catch (error) {
        logger.error('Failed to create scrape attempt', { error });
      }
    }

    try {
      const { moviesCount, showtimesCount } = await strategy.scrapeTheater(
        ctx.db,
        theater,
        date,
        movieDelayMs,
        progress
      );
      theaterMoviesCount += moviesCount;
      theaterShowtimesCount += showtimesCount;
      successfulDates++;
      logger.info('Date scraped successfully', { date, movies: moviesCount, showtimes: showtimesCount });

      if (attemptId) {
        try {
          await updateScrapeAttempt(ctx.db, attemptId, {
            status: 'success',
            movies_scraped: moviesCount,
            showtimes_scraped: showtimesCount,
          });
        } catch (error) {
          logger.error('Failed to update scrape attempt', { error });
        }
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.error('Rate limit detected - stopping all scraping', {
          theater: theater.name,
          date,
          statusCode: error.statusCode,
        });

        const errorType = classifyError(error);
        summary.errors.push({
          theater_name: theater.name,
          theater_id: theater.id,
          date,
          error: error.message,
          error_type: errorType,
          http_status_code: error.statusCode,
        });

        if (attemptId) {
          try {
            await updateScrapeAttempt(ctx.db, attemptId, {
              status: 'rate_limited',
              error_type: errorType,
              error_message: error.message,
              http_status_code: error.statusCode,
            });
          } catch (updateError) {
            logger.error('Failed to update scrape attempt', { error: updateError });
          }
        }

        // Mark THIS theater's remaining dates as not_attempted.
        if (options?.reportId) {
          const remainingDates = finalDatesToScrape.slice(finalDatesToScrape.indexOf(date) + 1);
          for (const remainingDate of remainingDates) {
            await markNotAttempted(ctx, options.reportId, theater.id, remainingDate);
          }
        }

        // Cascade not_attempted writes to the remaining theaters BEFORE
        // emitting date_failed, so any consumer that reads the DB in
        // reaction to the SSE event sees the final state — matches the
        // pre-refactor ordering (cascade_current → cascade_remaining →
        // date_failed emit).
        if (options?.reportId && cascade) {
          const remainingTheaters = cascade.allTheaters.slice(cascade.theaterIndex + 1);
          for (const remainingTheater of remainingTheaters) {
            for (const futureDate of cascade.datesToScrape) {
              await markNotAttempted(
                ctx,
                options.reportId,
                remainingTheater.id,
                futureDate
              );
            }
          }
        }

        await progress?.emit({
          type: 'date_failed',
          theater_name: theater.name,
          date,
          error: error.message,
        });

        summary.status = 'rate_limited';
        rateLimited = true;
        break;
      }

      // Non-rate-limit error: log, record, continue with the next date.
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = classifyError(error);
      logger.error('Date scrape failed', { theater: theater.name, date, error: errorMessage });

      summary.errors.push({
        theater_name: theater.name,
        theater_id: theater.id,
        date,
        error: errorMessage,
        error_type: errorType,
        http_status_code: (error as any).statusCode,
      });

      if (attemptId) {
        try {
          await updateScrapeAttempt(ctx.db, attemptId, {
            status: 'failed',
            error_type: errorType,
            error_message: errorMessage,
            http_status_code: (error as any).statusCode,
          });
        } catch (updateError) {
          logger.error('Failed to update scrape attempt', { error: updateError });
        }
      }

      await progress?.emit({
        type: 'date_failed',
        theater_name: theater.name,
        date,
        error: errorMessage,
      });
    }
  }

  await summarizeTheater(ctx, theater, {
    successfulDates,
    totalDates: finalDatesToScrape.length,
    moviesCount: theaterMoviesCount,
    showtimesCount: theaterShowtimesCount,
  });

  return {
    rateLimited,
    datesToScrape,
    successfulDates,
    moviesCount: theaterMoviesCount,
    showtimesCount: theaterShowtimesCount,
  };
}

/**
 * Load the dates that the theater has actually published, via the
 * strategy. On success returns { availableDates, failed: false }. On
 * failure logs, records the error in summary.errors, increments
 * summary.failed_theaters, and returns { availableDates: [], failed: true }
 * so the caller can short-circuit the rest of the theater processing.
 */
export async function loadTheaterAvailability(
  ctx: ScrapeContext,
  theater: TheaterConfig
): Promise<{ availableDates: string[]; failed: boolean }> {
  const strategy = getStrategyBySource(theater.source || 'allocine');
  const summary = ctx.summary;
  try {
    const meta = await strategy.loadTheaterMetadata(ctx.db, theater);
    return { availableDates: meta.availableDates, failed: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyError(error);
    logger.error('Failed to load theater metadata', {
      theater: theater.name,
      error: errorMessage,
    });
    summary.errors.push({
      theater_name: theater.name,
      theater_id: theater.id,
      error: errorMessage,
      error_type: errorType,
      http_status_code: (error as any).statusCode,
    });
    summary.failed_theaters++;
    return { availableDates: [], failed: true };
  }
}

/**
 * Intersect the requested `dates` with what the theater has actually
 * published (`availableDates`). When `options.resumeMode` is set, further
 * filter to only the dates listed in `options.pendingAttempts` for this
 * theater. Logs the skipped dates.
 */
export function filterDatesForScrape(
  theater: TheaterConfig,
  dates: string[],
  availableDates: string[],
  options: ScrapeOptions
): { datesToScrape: string[]; finalDatesToScrape: string[]; skippedDates: string[] } {
  const datesToScrape = dates.filter(d => availableDates.includes(d));
  const skippedDates = dates.filter(d => !availableDates.includes(d));
  if (skippedDates.length > 0) {
    logger.info('Skipping dates not yet published', {
      count: skippedDates.length,
      dates: skippedDates,
    });
  }

  let finalDatesToScrape = datesToScrape;
  if (options.resumeMode && options.pendingAttempts) {
    const pendingDatesForTheater = options.pendingAttempts
      .filter(a => a.theater_id === theater.id)
      .map(a => a.date);
    finalDatesToScrape = datesToScrape.filter(d => pendingDatesForTheater.includes(d));
    logger.info('Resume mode: filtered to pending attempts', {
      theater: theater.name,
      allDates: datesToScrape.length,
      pendingDates: finalDatesToScrape.length,
    });
  }

  return { datesToScrape, finalDatesToScrape, skippedDates };
}

/**
 * Fold the per-theater counters into the shared summary and emit
 * `theater_completed` if the theater succeeded (at least one date
 * scraped). Returns `true` for a successful theater, `false` for a
 * fully-failed one. The actual failed_theaters++ / total_movies += etc.
 * mutations happen here so the caller stays declarative.
 */
export async function summarizeTheater(
  ctx: ScrapeContext,
  theater: TheaterConfig,
  counts: {
    successfulDates: number;
    totalDates: number;
    moviesCount: number;
    showtimesCount: number;
  }
): Promise<boolean> {
  const { summary, progress } = ctx;
  const theaterFailed = counts.successfulDates === 0 && counts.totalDates > 0;
  logger.info('Theater summary', {
    theater: theater.name,
    successfulDates: counts.successfulDates,
    totalDates: counts.totalDates,
    movies: counts.moviesCount,
    showtimes: counts.showtimesCount,
  });

  if (!theaterFailed) {
    summary.successful_theaters++;
    summary.total_movies += counts.moviesCount;
    summary.total_showtimes += counts.showtimesCount;
    await progress?.emit({
      type: 'theater_completed',
      theater_name: theater.name,
      total_movies: counts.moviesCount,
    });
    return true;
  }

  summary.failed_theaters++;
  logger.error('Theater failed completely', { theater: theater.name, dates: counts.totalDates });
  return false;
}

/**
 * Build the ScrapeContext used by the helpers, reading delay config
 * from the environment. Centralized so the runScraper body stays small.
 */
function createScrapeContext(
  summary: ScrapeSummary,
  progress?: ProgressPublisher
): ScrapeContext {
  const theaterDelayMs = parseInt(process.env.SCRAPE_THEATER_DELAY_MS || '3000', 10);
  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  return {
    db,
    summary,
    progress,
    movieDelayMs,
    theaterDelayMs,
  };
}

/**
 * Run one iteration of the theater loop: emit `theater_started`, run the
 * strategy, and on rate limit log the stop and signal the caller to break.
 *
 * The cascade of not_attempted writes to the remaining theaters happens
 * INSIDE scrapeTheaterWithStrategy (just before the date_failed emit) so
 * the SSE consumers see a consistent DB state at emit time.
 */
async function processTheater(
  theater: TheaterConfig,
  index: number,
  theaters: TheaterConfig[],
  dates: string[],
  ctx: ScrapeContext,
  options?: ScrapeOptions
): Promise<{ rateLimited: boolean }> {
  const strategy = getStrategyBySource(theater.source || 'allocine');

  await ctx.progress?.emit({
    type: 'theater_started',
    theater_name: theater.name,
    theater_id: theater.id,
    index: index + 1,
  });

  logger.info(`Processing theater using ${strategy.sourceName} strategy`, {
    theater: theater.name,
    id: theater.id,
  });

  // Build the cascade context now (before the await) so we can pass it
  // to scrapeTheaterWithStrategy. datesToScrape is the global dates list
  // intersected with what the theater publishes happens inside the helper;
  // the original code used `datesToScrape` (the un-resume-filtered set),
  // which is equivalent to `dates` here when resumeMode is off and a
  // safe upper bound when it's on (extra not_attempted rows for dates
  // the theater wouldn't have published anyway are a no-op in practice).
  const result = await scrapeTheaterWithStrategy(theater, dates, ctx, options, {
    allTheaters: theaters,
    theaterIndex: index,
    datesToScrape: dates,
  });

  if (!result.rateLimited) {
    return { rateLimited: false };
  }

  logger.warn('Stopping scrape due to rate limit', {
    processedTheaters: index + 1,
    totalTheaters: theaters.length,
  });

  return { rateLimited: true };
}

/**
 * Successful end-of-run bookkeeping: stamp duration, log, close browser,
 * emit `completed`. Always run from the happy path of runScraper.
 */
async function finalizeScrape(
  ctx: ScrapeContext,
  startTime: number
): Promise<void> {
  ctx.summary.duration_ms = Date.now() - startTime;
  logger.info('Scraping completed', { summary: ctx.summary });
  await closeBrowser();
  await ctx.progress?.emit({ type: 'completed', summary: ctx.summary });
}

/**
 * Fatal-error path: log, record a 'System' error, close browser, emit
 * `failed`, and rethrow so the caller still sees the exception. Always
 * run from the catch block of runScraper.
 */
async function handleFatalError(
  ctx: ScrapeContext,
  startTime: number,
  error: unknown
): Promise<never> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorType = classifyError(error);
  logger.error('Fatal error in scraper', { error });
  await closeBrowser();
  ctx.summary.errors.push({
    theater_name: 'System',
    theater_id: 'system',
    error: errorMessage,
    error_type: errorType,
    http_status_code: (error as any).statusCode,
  });
  ctx.summary.duration_ms = Date.now() - startTime;
  await ctx.progress?.emit({ type: 'failed', error: errorMessage });
  throw error;
}

export async function runScraper(
  progress?: ProgressPublisher,
  options?: ScrapeOptions
): Promise<ScrapeSummary> {
  logger.info('Starting scraper');

  const summary: ScrapeSummary = {
    total_theaters: 0,
    successful_theaters: 0,
    failed_theaters: 0,
    total_movies: 0,
    total_showtimes: 0,
    total_dates: 0,
    duration_ms: 0,
    errors: [],
  };

  const ctx = createScrapeContext(summary, progress);
  const startTime = Date.now();

  try {
    const { theaters, dates } = await prepareSchedule(ctx, options);

    for (let i = 0; i < theaters.length; i++) {
      const { rateLimited } = await processTheater(
        theaters[i], i, theaters, dates, ctx, options
      );
      if (rateLimited) break;
      if (i < theaters.length - 1) {
        logger.info('Waiting before next theater', { delayMs: ctx.theaterDelayMs });
        await delay(ctx.theaterDelayMs);
      }
    }

    await finalizeScrape(ctx, startTime);
    return summary;
  } catch (error) {
    await handleFatalError(ctx, startTime, error);
    // Unreachable: handleFatalError always rethrows.
    throw error;
  }
}
