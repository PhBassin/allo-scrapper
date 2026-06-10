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
 */
export interface ScrapeContext {
  db: DB;
  summary: ScrapeSummary;
  progress?: ProgressPublisher;
  movieDelayMs: number;
  theaterDelayMs: number;
}

/** Result of prepareSchedule: which theaters to scrape, on which dates. */
export interface ScrapeSchedule {
  theaters: TheaterConfig[];
  dates: string[];
  scrapeMode: ScrapeMode;
  scrapeDays: number;
}

/** Per-theater outcome reported back to runScraper. */
export interface ScrapeTheaterResult {
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
): Promise<ScrapeSchedule> {
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
  options?: ScrapeOptions
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
  let availableDates: string[] = [];
  try {
    const meta = await strategy.loadTheaterMetadata(ctx.db, theater);
    availableDates = meta.availableDates;
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
    return {
      rateLimited: false,
      datesToScrape: [],
      successfulDates: 0,
      moviesCount: 0,
      showtimesCount: 0,
    };
  }

  // Intersect requested dates with what the theater has published.
  const datesToScrape = dates.filter(d => availableDates.includes(d));
  const skippedDates = dates.filter(d => !availableDates.includes(d));
  if (skippedDates.length > 0) {
    logger.info('Skipping dates not yet published', {
      count: skippedDates.length,
      dates: skippedDates,
    });
  }

  // In resume mode, restrict further to pending attempts for this theater.
  let finalDatesToScrape = datesToScrape;
  if (options?.resumeMode && options?.pendingAttempts) {
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

  const theaterFailed = successfulDates === 0 && finalDatesToScrape.length > 0;
  logger.info('Theater summary', {
    theater: theater.name,
    successfulDates,
    totalDates: finalDatesToScrape.length,
    movies: theaterMoviesCount,
    showtimes: theaterShowtimesCount,
  });

  if (!theaterFailed) {
    summary.successful_theaters++;
    summary.total_movies += theaterMoviesCount;
    summary.total_showtimes += theaterShowtimesCount;
    await progress?.emit({
      type: 'theater_completed',
      theater_name: theater.name,
      total_movies: theaterMoviesCount,
    });
  } else {
    summary.failed_theaters++;
    logger.error('Theater failed completely', { theater: theater.name, dates: datesToScrape.length });
  }

  return {
    rateLimited,
    datesToScrape,
    successfulDates,
    moviesCount: theaterMoviesCount,
    showtimesCount: theaterShowtimesCount,
  };
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

  const startTime = Date.now();

  // Read delay configuration from environment
  const theaterDelayMs = parseInt(process.env.SCRAPE_THEATER_DELAY_MS || '3000', 10);
  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);

  const ctx: ScrapeContext = {
    db,
    summary,
    progress,
    movieDelayMs,
    theaterDelayMs,
  };

  try {
    const { theaters, dates } = await prepareSchedule(ctx, options);

    for (let i = 0; i < theaters.length; i++) {
      const theater = theaters[i];
      const strategy = getStrategyBySource(theater.source || 'allocine');

      await progress?.emit({
        type: 'theater_started',
        theater_name: theater.name,
        theater_id: theater.id,
        index: i + 1,
      });

      logger.info(`Processing theater using ${strategy.sourceName} strategy`, {
        theater: theater.name,
        id: theater.id,
      });

      const result = await scrapeTheaterWithStrategy(theater, dates, ctx, options);

      // If a rate limit was hit, stop processing further theaters.
      if (result.rateLimited) {
        logger.warn('Stopping scrape due to rate limit', {
          processedTheaters: i + 1,
          totalTheaters: theaters.length,
        });

        // Cascade: mark remaining theaters and ALL their dates as not_attempted.
        if (options?.reportId) {
          const remainingTheaters = theaters.slice(i + 1);
          for (const remainingTheater of remainingTheaters) {
            for (const futureDate of result.datesToScrape) {
              await markNotAttempted(ctx, options.reportId, remainingTheater.id, futureDate);
            }
          }
        }
        break;
      }

      // Apply delay between theaters (except after the last one).
      if (i < theaters.length - 1) {
        logger.info('Waiting before next theater', { delayMs: theaterDelayMs });
        await delay(theaterDelayMs);
      }
    }

    summary.duration_ms = Date.now() - startTime;
    logger.info('Scraping completed', { summary });
    await closeBrowser();

    await progress?.emit({ type: 'completed', summary });

    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyError(error);
    logger.error('Fatal error in scraper', { error });
    await closeBrowser();
    summary.errors.push({
      theater_name: 'System',
      theater_id: 'system',
      error: errorMessage,
      error_type: errorType,
      http_status_code: (error as any).statusCode,
    });
    summary.duration_ms = Date.now() - startTime;
    await progress?.emit({ type: 'failed', error: errorMessage });
    throw error;
  }
}
