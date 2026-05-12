import pLimit from 'p-limit';
import { db, type DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { getTheaterConfigs, getTheaters } from '../db/theater-queries.js';
import { closeBrowser, delay, circuitBreaker } from './http-client.js';
import { getScrapeDates, type ScrapeMode } from '../utils/date.js';
import type { TheaterConfig, Theater, ProgressEvent, ScrapeSummary } from '../types/scraper.js';
import { getStrategyByUrl, getStrategyBySource } from './strategy-factory.js';
import { RateLimitError } from '../utils/errors.js';
import { classifyError } from '../utils/error-classifier.js';
import { CircuitOpenError } from './circuit-breaker.js';
import { getTracer } from '../utils/tracer.js';
import { context, trace } from '@opentelemetry/api';
import {
  createScrapeAttempt,
  updateScrapeAttempt,
} from '../db/scrape-attempt-queries.js';

// Progress publisher interface – allows injecting Redis publisher or a no-op
export interface ProgressPublisher {
  emit(event: ProgressEvent): Promise<void>;
}

function setOrgSpanAttributes(traceContext?: Record<string, string>): void {
  if (!traceContext) return;

  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    if (traceContext.org_id) activeSpan.setAttribute('org_id', traceContext.org_id);
    if (traceContext.org_slug) activeSpan.setAttribute('org_slug', traceContext.org_slug);
    if (traceContext.user_id) activeSpan.setAttribute('user_id', traceContext.user_id);
    if (traceContext.endpoint) activeSpan.setAttribute('endpoint', traceContext.endpoint);
    if (traceContext.method) activeSpan.setAttribute('method', traceContext.method);
    return;
  }

  const span = getTracer().startSpan('scraper.job.org-context');
  if (traceContext.org_id) span.setAttribute('org_id', traceContext.org_id);
  if (traceContext.org_slug) span.setAttribute('org_slug', traceContext.org_slug);
  if (traceContext.user_id) span.setAttribute('user_id', traceContext.user_id);
  if (traceContext.endpoint) span.setAttribute('endpoint', traceContext.endpoint);
  if (traceContext.method) span.setAttribute('method', traceContext.method);
  span.end();
}

// No-op publisher for standalone use
export class NoopProgressPublisher implements ProgressPublisher {
  async emit(_event: ProgressEvent): Promise<void> {}
}

function withReportId(event: ProgressEvent, reportId?: number): ProgressEvent {
  if (reportId == null || event.report_id != null) {
    return event;
  }

  return {
    ...event,
    report_id: reportId,
  };
}

function withJobMetadata(event: ProgressEvent, options?: ScrapeOptions): ProgressEvent {
  const withReport = withReportId(event, options?.reportId);
  if (!options?.traceContext || withReport.traceContext) {
    return withReport;
  }

  return {
    ...withReport,
    traceContext: options.traceContext,
  };
}

/**
 * Backward compatibility wrapper for loadTheaterPageMetadata.
 * Delegates to the appropriate strategy based on the theater URL.
 */
export async function loadTheaterPageMetadata(
  db: DB,
  theater: TheaterConfig
): Promise<{ availableDates: string[]; theater: Theater }> {
  const strategy = getStrategyBySource(theater.source || 'allocine');
  return strategy.loadTheaterPageMetadata(db, theater);
}

/**
 * Scraper un cinéma pour une date donnée (backward compatibility wrapper).
 */
export async function scrapeTheaterPage(
  db: DB,
  theater: TheaterConfig,
  date: string,
  movieDelayMs: number,
  progress?: ProgressPublisher
): Promise<{ moviesCount: number; showtimesCount: number }> {
  const strategy = getStrategyBySource(theater.source || 'allocine');
  return strategy.scrapeTheaterPage(db, theater, date, movieDelayMs, progress);
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
  const { availableDates, theater } = await strategy.loadTheaterPageMetadata(db, tempConfig);

  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  logger.info(`Scraping ${availableDates.length} available date(s)...`, { theater: theater.name });

  for (const date of availableDates) {
    try {
      await strategy.scrapeTheaterPage(db, tempConfig, date, movieDelayMs, progress);
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
  traceContext?: Record<string, string>;
}

/**
 * Process a single theater and all its dates.
 * Extracted from runScraper for concurrency support.
 */
async function processTheater(
  db: DB,
  theater: TheaterConfig,
  dates: string[],
  options: ScrapeOptions | undefined,
  theaterPageDelayMs: number,
  movieDelayMs: number,
  progress: ProgressPublisher | undefined,
  summary: ScrapeSummary,
  index: number,
  total: number,
  isAborted: () => boolean
): Promise<void> {
  if (isAborted()) return;

  const strategy = getStrategyBySource(theater.source || 'allocine');

  await progress?.emit({
    type: 'theater_started',
    theater_name: theater.name,
    theater_id: theater.id,
    index: index + 1,
  });

  let theaterMoviesCount = 0;
  let theaterShowtimesCount = 0;
  let successfulDates = 0;

  logger.info(`Processing theater using ${strategy.sourceName} strategy`, { theater: theater.name, id: theater.id });

  let availableDates: string[] = [];
  try {
    const meta = await strategy.loadTheaterPageMetadata(db, theater);
    availableDates = meta.availableDates;
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof CircuitOpenError) {
      const isRateLimit = error instanceof RateLimitError;
      logger.error(isRateLimit ? 'Rate limit detected - stopping all scraping' : 'Circuit open detected - stopping all scraping', { 
        theater: theater.name, 
        error: error.message 
      });
      summary.status = isRateLimit ? 'rate_limited' : 'circuit_open';
      
      const errorType = classifyError(error);
      summary.errors.push({
        theater_name: theater.name,
        theater_id: theater.id,
        error: error.message,
        error_type: errorType,
        http_status_code: (error as any).statusCode,
      });
      summary.failed_theaters++;
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyError(error);
    logger.error('Failed to load theater metadata', { theater: theater.name, error: errorMessage });
    summary.errors.push({ 
      theater_name: theater.name, 
      theater_id: theater.id,
      error: errorMessage,
      error_type: errorType,
      http_status_code: (error as any).statusCode,
    });
    summary.failed_theaters++;
    return;
  }

  const datesToScrape = dates.filter(d => availableDates.includes(d));
  const skippedDates = dates.filter(d => !availableDates.includes(d));

  if (skippedDates.length > 0) {
    logger.info('Skipping dates not yet published', { count: skippedDates.length, dates: skippedDates });
  }
  
  // In resume mode, only scrape dates from pendingAttempts
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
    if (isAborted()) break;

    logger.info('Attempting date', { theater: theater.name, date });
    
    // Track attempt in database if reportId provided
    let attemptId: number | undefined;
      if (options?.reportId) {
        try {
          attemptId = await createScrapeAttempt(db, {
          report_id: options.reportId,
          theater_id: theater.id,
          date: date,
          status: 'pending',
        });
      } catch (error) {
        logger.error('Failed to create scrape attempt', { error });
      }
    }
    
    try {
      const { moviesCount, showtimesCount } = await strategy.scrapeTheaterPage(db, theater, date, movieDelayMs, progress);
      theaterMoviesCount += moviesCount;
      theaterShowtimesCount += showtimesCount;
      successfulDates++;
      logger.info('Date scraped successfully', { date, movies: moviesCount, showtimes: showtimesCount });
      
      // Update attempt as successful
      if (attemptId) {
        try {
          await updateScrapeAttempt(db, attemptId, {
            status: 'success',
            movies_scraped: moviesCount,
            showtimes_scraped: showtimesCount,
          });
        } catch (error) {
          logger.error('Failed to update scrape attempt', { error });
        }
      }
    } catch (error: any) {
      // Detect rate limiting or circuit breaker open and signal abortion
      if (error instanceof RateLimitError || error instanceof CircuitOpenError) {
        const isRateLimit = error instanceof RateLimitError;
        logger.error(isRateLimit ? 'Rate limit detected - stopping all scraping' : 'Circuit open detected - stopping all scraping', { 
          theater: theater.name, 
          date, 
          statusCode: (error as any).statusCode 
        });
        
        const errorType = classifyError(error);
        summary.errors.push({
          theater_name: theater.name,
          theater_id: theater.id,
          date: date,
          error: error.message,
          error_type: errorType,
          http_status_code: (error as any).statusCode,
        });

        // Update attempt as rate_limited or failed
        if (attemptId) {
          try {
            await updateScrapeAttempt(db, attemptId, {
              status: isRateLimit ? 'rate_limited' : 'failed',
              error_type: errorType,
              error_message: error.message,
              http_status_code: (error as any).statusCode,
            });
          } catch (updateError) {
            logger.error('Failed to update scrape attempt', { error: updateError });
          }
        }

        // Mark remaining dates as not_attempted
        if (options?.reportId) {
          const remainingDates = finalDatesToScrape.slice(finalDatesToScrape.indexOf(date) + 1);
          for (const remainingDate of remainingDates) {
            try {
              await createScrapeAttempt(db, {
                report_id: options.reportId,
                theater_id: theater.id,
                date: remainingDate,
                status: 'not_attempted',
              });
            } catch (error) {
              logger.error('Failed to mark attempt as not_attempted', { error });
            }
          }
        }

        await progress?.emit({
          type: 'date_failed',
          theater_name: theater.name,
          date: date,
          error: error.message
        });

        // Mark status
        summary.status = isRateLimit ? 'rate_limited' : 'circuit_open';
        return;
      }

      // Handle other errors normally
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = classifyError(error);
      logger.error('Date scrape failed', { theater: theater.name, date, error: errorMessage });
      
      summary.errors.push({
        theater_name: theater.name,
        theater_id: theater.id,
        date: date,
        error: errorMessage,
        error_type: errorType,
        http_status_code: (error as any).statusCode,
      });

      // Update attempt as failed
      if (attemptId) {
        try {
          await updateScrapeAttempt(db, attemptId, {
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
        date: date,
        error: errorMessage
      });

      continue;
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
    logger.error('Theater failed completely', { theater: theater.name, dates: finalDatesToScrape.length });
  }

  // Apply delay between theaters (except after the last one)
  if (index < total - 1 && !isAborted()) {
    logger.info('Waiting before next theater', { delayMs: theaterPageDelayMs });
    await delay(theaterPageDelayMs);
  }
}

export async function runScraper(
  progress?: ProgressPublisher,
  options?: ScrapeOptions,
  dbHandle: DB = db,
): Promise<ScrapeSummary> {
  setOrgSpanAttributes(options?.traceContext);
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
  const theaterPageDelayMs = parseInt(process.env.SCRAPE_THEATER_DELAY_MS || '3000', 10);
  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  const concurrency = parseInt(process.env.SCRAPER_CONCURRENCY || '2', 10);
  const scopedProgress: ProgressPublisher | undefined = progress
    ? {
        emit: async (event) => {
          await progress.emit(withJobMetadata(event, options));
        },
      }
    : undefined;

  try {
    let theaters = await getTheaterConfigs(dbHandle);
    
    // Filter to specific theater if provided
    if (options?.theaterId) {
      // First verify theater exists in database (source of truth)
      const allTheatersFromDb = await getTheaters(dbHandle);
      const theaterExistsInDb = allTheatersFromDb.some((c: Theater) => c.id === options.theaterId);
      
      if (!theaterExistsInDb) {
        throw new Error(`Theater not found in database: ${options.theaterId}`);
      }
      
      // Then check if theater is configured for scraping
      const foundTheater = theaters.find(c => c.id === options.theaterId);
      if (!foundTheater) {
        throw new Error(`Theater not configured for scraping: ${options.theaterId}`);
      }
      
      theaters = [foundTheater];
      logger.info(`Scraping only theater: ${foundTheater.name} (${foundTheater.id})`);
    }
    
    logger.info('Theaters loaded', { count: theaters.length });

    // Read scrape config from database settings (fallback to safe defaults)
    let scrapeMode: ScrapeMode = 'from_today_limited';
    let scrapeDays = 7;
    try {
      const settingsResult = await dbHandle.query<{ scrape_mode: string; scrape_days: number }>(
        'SELECT scrape_mode, scrape_days FROM app_settings WHERE id = 1'
      );
      if (settingsResult.rows.length > 0) {
        scrapeMode = settingsResult.rows[0].scrape_mode as ScrapeMode;
        scrapeDays = settingsResult.rows[0].scrape_days;
      }
    } catch (err) {
      logger.warn('Could not read scrape settings from DB, using defaults', { err });
    }

    // Options passed explicitly (e.g. from a job) override DB settings
    if (options?.mode) scrapeMode = options.mode;
    if (options?.days) scrapeDays = options.days;

    const dates = getScrapeDates(scrapeMode, scrapeDays);
    logger.info('Scrape config', { mode: scrapeMode, dates: dates.length, scrapeDays });
    logger.info('Delay config', { theaterPageDelayMs, movieDelayMs, concurrency });

    summary.total_theaters = theaters.length;
    summary.total_dates = dates.length;

    await scopedProgress?.emit({
      type: 'started',
      total_theaters: theaters.length,
      total_dates: dates.length,
    });

    const limit = pLimit(concurrency);
    const isAborted = () => summary.status === 'rate_limited' || summary.status === 'circuit_open';

    const tasks = theaters.map((theater, i) => 
      limit(() => processTheater(
        dbHandle,
        theater,
        dates,
        options,
        theaterPageDelayMs,
        movieDelayMs,
        scopedProgress,
        summary,
        i,
        theaters.length,
        isAborted
      ))
    );

    await Promise.allSettled(tasks);

    summary.duration_ms = Date.now() - startTime;
    summary.circuit_state = circuitBreaker.getState();
    if (!summary.status) {
      summary.status = summary.failed_theaters === 0
        ? 'success'
        : summary.successful_theaters > 0
          ? 'partial_success'
          : 'failed';
    }
    logger.info('Scraping completed', { summary });
    await closeBrowser();

    await scopedProgress?.emit({ type: 'completed', summary });

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
    summary.circuit_state = circuitBreaker.getState();
    await scopedProgress?.emit({ type: 'failed', error: errorMessage });
    throw error;
  }
}
