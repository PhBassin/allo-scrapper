import pLimit from 'p-limit';
import { db, type DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { getCinemaConfigs, getCinemas } from '../db/cinema-queries.js';
import { closeBrowser, delay, circuitBreaker } from './http-client.js';
import { getScrapeDates, type ScrapeMode } from '../utils/date.js';
import type { CinemaConfig, Cinema, ProgressEvent, ScrapeSummary } from '../types/scraper.js';
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
 * Backward compatibility wrapper for loadTheaterMetadata.
 * Delegates to the appropriate strategy based on the cinema URL.
 */
export async function loadTheaterMetadata(
  db: DB,
  cinema: CinemaConfig
): Promise<{ availableDates: string[]; cinema: Cinema }> {
  const strategy = getStrategyBySource(cinema.source || 'allocine');
  return strategy.loadTheaterMetadata(db, cinema);
}

/**
 * Scraper un cinéma pour une date donnée (backward compatibility wrapper).
 */
export async function scrapeTheater(
  db: DB,
  cinema: CinemaConfig,
  date: string,
  movieDelayMs: number,
  progress?: ProgressPublisher
): Promise<{ filmsCount: number; showtimesCount: number }> {
  const strategy = getStrategyBySource(cinema.source || 'allocine');
  return strategy.scrapeTheater(db, cinema, date, movieDelayMs, progress);
}

/**
 * Add a new cinema by URL and scrape all available showtimes for it.
 * Resolves the appropriate strategy from the URL, extracts metadata,
 * then scrapes every available date.
 */
export async function addCinemaAndScrape(
  db: DB,
  url: string,
  progress?: ProgressPublisher
): Promise<Cinema> {
  const strategy = getStrategyByUrl(url);
  
  const cinemaId = strategy.extractCinemaId(url);
  if (!cinemaId) {
    throw new Error(`Could not extract cinema ID from URL: ${url}`);
  }

  const cleanedUrl = strategy.cleanCinemaUrl(url);
  const tempConfig: CinemaConfig = { 
    id: cinemaId, 
    name: cinemaId, 
    url: cleanedUrl,
    source: strategy.sourceName 
  };

  logger.info(`Adding new cinema from ${url} using ${strategy.sourceName} strategy...`);
  const { availableDates, cinema } = await strategy.loadTheaterMetadata(db, tempConfig);

  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  logger.info(`Scraping ${availableDates.length} available date(s)...`, { cinema: cinema.name });

  for (const date of availableDates) {
    try {
      await strategy.scrapeTheater(db, tempConfig, date, movieDelayMs, progress);
    } catch (error) {
      logger.error('Failed to scrape date', { date, cinema: cinema.name, error });
    }
  }

  await closeBrowser();
  logger.info('Cinema added successfully', { cinema: cinema.name, id: cinema.id });

  return cinema;
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
  cinemaId?: string;
  filmId?: number;
  reportId?: number;  // For tracking attempts in database
  resumeMode?: boolean;  // Skip already-successful attempts
  pendingAttempts?: Array<{ cinema_id: string; date: string }>;  // For resume mode
  traceContext?: Record<string, string>;
}

/**
 * Process a single cinema and all its dates.
 * Extracted from runScraper for concurrency support.
 */
async function processCinema(
  db: DB,
  cinema: CinemaConfig,
  dates: string[],
  options: ScrapeOptions | undefined,
  theaterDelayMs: number,
  movieDelayMs: number,
  progress: ProgressPublisher | undefined,
  summary: ScrapeSummary,
  index: number,
  total: number,
  isAborted: () => boolean
): Promise<void> {
  if (isAborted()) return;

  const strategy = getStrategyBySource(cinema.source || 'allocine');

  await progress?.emit({
    type: 'cinema_started',
    cinema_name: cinema.name,
    cinema_id: cinema.id,
    index: index + 1,
  });

  let cinemaFilmsCount = 0;
  let cinemaShowtimesCount = 0;
  let successfulDates = 0;

  logger.info(`Processing cinema using ${strategy.sourceName} strategy`, { cinema: cinema.name, id: cinema.id });

  let availableDates: string[] = [];
  try {
    const meta = await strategy.loadTheaterMetadata(db, cinema);
    availableDates = meta.availableDates;
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof CircuitOpenError) {
      const isRateLimit = error instanceof RateLimitError;
      logger.error(isRateLimit ? 'Rate limit detected - stopping all scraping' : 'Circuit open detected - stopping all scraping', { 
        cinema: cinema.name, 
        error: error.message 
      });
      summary.status = isRateLimit ? 'rate_limited' : 'circuit_open';
      
      const errorType = classifyError(error);
      summary.errors.push({
        cinema_name: cinema.name,
        cinema_id: cinema.id,
        error: error.message,
        error_type: errorType,
        http_status_code: (error as any).statusCode,
      });
      summary.failed_cinemas++;
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyError(error);
    logger.error('Failed to load theater metadata', { cinema: cinema.name, error: errorMessage });
    summary.errors.push({ 
      cinema_name: cinema.name, 
      cinema_id: cinema.id,
      error: errorMessage,
      error_type: errorType,
      http_status_code: (error as any).statusCode,
    });
    summary.failed_cinemas++;
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
    const pendingDatesForCinema = options.pendingAttempts
      .filter(a => a.cinema_id === cinema.id)
      .map(a => a.date);
    
    finalDatesToScrape = datesToScrape.filter(d => pendingDatesForCinema.includes(d));
    
    logger.info('Resume mode: filtered to pending attempts', { 
      cinema: cinema.name, 
      allDates: datesToScrape.length,
      pendingDates: finalDatesToScrape.length,
    });
  }
  
  logger.info('Dates to scrape', { cinema: cinema.name, count: finalDatesToScrape.length });

  for (const date of finalDatesToScrape) {
    if (isAborted()) break;

    logger.info('Attempting date', { cinema: cinema.name, date });
    
    // Track attempt in database if reportId provided
    let attemptId: number | undefined;
      if (options?.reportId) {
        try {
          attemptId = await createScrapeAttempt(db, {
          report_id: options.reportId,
          cinema_id: cinema.id,
          date: date,
          status: 'pending',
        });
      } catch (error) {
        logger.error('Failed to create scrape attempt', { error });
      }
    }
    
    try {
      const { filmsCount, showtimesCount } = await strategy.scrapeTheater(db, cinema, date, movieDelayMs, progress);
      cinemaFilmsCount += filmsCount;
      cinemaShowtimesCount += showtimesCount;
      successfulDates++;
      logger.info('Date scraped successfully', { date, films: filmsCount, showtimes: showtimesCount });
      
      // Update attempt as successful
      if (attemptId) {
        try {
          await updateScrapeAttempt(db, attemptId, {
            status: 'success',
            films_scraped: filmsCount,
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
          cinema: cinema.name, 
          date, 
          statusCode: (error as any).statusCode 
        });
        
        const errorType = classifyError(error);
        summary.errors.push({
          cinema_name: cinema.name,
          cinema_id: cinema.id,
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
                cinema_id: cinema.id,
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
          cinema_name: cinema.name,
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
      logger.error('Date scrape failed', { cinema: cinema.name, date, error: errorMessage });
      
      summary.errors.push({
        cinema_name: cinema.name,
        cinema_id: cinema.id,
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
        cinema_name: cinema.name,
        date: date,
        error: errorMessage
      });

      continue;
    }
  }

  const cinemaFailed = successfulDates === 0 && finalDatesToScrape.length > 0;

  logger.info('Cinema summary', {
    cinema: cinema.name,
    successfulDates,
    totalDates: finalDatesToScrape.length,
    films: cinemaFilmsCount,
    showtimes: cinemaShowtimesCount,
  });

  if (!cinemaFailed) {
    summary.successful_cinemas++;
    summary.total_films += cinemaFilmsCount;
    summary.total_showtimes += cinemaShowtimesCount;
    await progress?.emit({
      type: 'cinema_completed',
      cinema_name: cinema.name,
      total_films: cinemaFilmsCount,
    });
  } else {
    summary.failed_cinemas++;
    logger.error('Cinema failed completely', { cinema: cinema.name, dates: finalDatesToScrape.length });
  }

  // Apply delay between cinemas (except after the last one)
  if (index < total - 1 && !isAborted()) {
    logger.info('Waiting before next cinema', { delayMs: theaterDelayMs });
    await delay(theaterDelayMs);
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
    total_cinemas: 0,
    successful_cinemas: 0,
    failed_cinemas: 0,
    total_films: 0,
    total_showtimes: 0,
    total_dates: 0,
    duration_ms: 0,
    errors: [],
  };

  const startTime = Date.now();

  // Read delay configuration from environment
  const theaterDelayMs = parseInt(process.env.SCRAPE_THEATER_DELAY_MS || '3000', 10);
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
    let cinemas = await getCinemaConfigs(dbHandle);
    
    // Filter to specific cinema if provided
    if (options?.cinemaId) {
      // First verify cinema exists in database (source of truth)
      const allCinemasFromDb = await getCinemas(dbHandle);
      const cinemaExistsInDb = allCinemasFromDb.some((c: Cinema) => c.id === options.cinemaId);
      
      if (!cinemaExistsInDb) {
        throw new Error(`Cinema not found in database: ${options.cinemaId}`);
      }
      
      // Then check if cinema is configured for scraping
      const foundCinema = cinemas.find(c => c.id === options.cinemaId);
      if (!foundCinema) {
        throw new Error(`Cinema not configured for scraping: ${options.cinemaId}`);
      }
      
      cinemas = [foundCinema];
      logger.info(`Scraping only cinema: ${foundCinema.name} (${foundCinema.id})`);
    }
    
    logger.info('Cinemas loaded', { count: cinemas.length });

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
    logger.info('Delay config', { theaterDelayMs, movieDelayMs, concurrency });

    summary.total_cinemas = cinemas.length;
    summary.total_dates = dates.length;

    await scopedProgress?.emit({
      type: 'started',
      total_cinemas: cinemas.length,
      total_dates: dates.length,
    });

    const limit = pLimit(concurrency);
    const isAborted = () => summary.status === 'rate_limited' || summary.status === 'circuit_open';

    const tasks = cinemas.map((cinema, i) => 
      limit(() => processCinema(
        dbHandle,
        cinema,
        dates,
        options,
        theaterDelayMs,
        movieDelayMs,
        scopedProgress,
        summary,
        i,
        cinemas.length,
        isAborted
      ))
    );

    await Promise.allSettled(tasks);

    summary.duration_ms = Date.now() - startTime;
    summary.circuit_state = circuitBreaker.getState();
    if (!summary.status) {
      summary.status = summary.failed_cinemas === 0
        ? 'success'
        : summary.successful_cinemas > 0
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
      cinema_name: 'System', 
      cinema_id: 'system',
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
