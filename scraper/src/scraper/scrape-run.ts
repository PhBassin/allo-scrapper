import type { DB } from '../db/client.js';
import {
  getTheaterConfigs,
  getTheaters,
} from '../db/theater-queries.js';
import {
  createScrapeAttempt,
  updateScrapeAttempt,
} from '../db/scrape-attempt-queries.js';
import { closeBrowser } from './http-client.js';
import { getScrapeDates, type ScrapeMode } from '../utils/date.js';
import { logger } from '../utils/logger.js';
import { RateLimitError } from '../utils/errors.js';
import { classifyError } from '../utils/error-classifier.js';
import { getStrategyBySource } from './strategy-factory.js';
import type {
  TheaterConfig,
  Theater,
  ProgressEvent,
  ScrapeSummary,
} from '../types/scraper.js';
import type { ScrapeConfig } from './scrape-config.js';
import type { ErrorType } from '../utils/error-classifier.js';

export interface ProgressPublisher {
  emit(event: ProgressEvent): Promise<void>;
}

export interface ScrapeErrorEntry {
  theater_name: string;
  theater_id: string;
  date?: string;
  error: string;
  error_type: ErrorType;
  http_status_code?: number;
}

/** Error details stamped on a `failed` ScrapeAttempt. */
export interface AttemptFailure {
  error_type: ErrorType;
  error_message: string;
  http_status_code?: number;
}

export interface CascadeContext {
  allTheaters: TheaterConfig[];
  theaterIndex: number;
  datesToScrape: string[];
}

export interface PrepareResult {
  theaters: TheaterConfig[];
  dates: string[];
  scrapeMode: ScrapeMode;
  scrapeDays: number;
}

export interface DateOutcome {
  status: 'success' | 'rate_limited' | 'error';
  moviesCount?: number;
  showtimesCount?: number;
}

export interface FilterDatesResult {
  datesToScrape: string[];
  finalDatesToScrape: string[];
  skippedDates: string[];
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
  theaterId?: string;
  movieId?: number;
  reportId?: number;
  resumeMode?: boolean;
  pendingAttempts?: Array<{ theater_id: string; date: string }>;
}

export class ScrapeRun implements ProgressPublisher {
  readonly db: DB;
  readonly config: ScrapeConfig;
  readonly summary: ScrapeSummary;
  private readonly progress?: ProgressPublisher;

  constructor(db: DB, config: ScrapeConfig, progress?: ProgressPublisher) {
    this.db = db;
    this.config = config;
    this.progress = progress;
    this.summary = {
      total_theaters: 0,
      successful_theaters: 0,
      failed_theaters: 0,
      total_movies: 0,
      total_showtimes: 0,
      total_dates: 0,
      duration_ms: 0,
      errors: [],
    };
  }

  recordError(entry: ScrapeErrorEntry): void {
    this.summary.errors.push(entry);
  }

  recordSystemError(errorMessage: string, errorType: ErrorType): void {
    this.summary.errors.push({
      theater_name: 'System',
      theater_id: 'system',
      error: errorMessage,
      error_type: errorType,
    });
  }

  incrementSuccessfulTheater(movies: number, showtimes: number): void {
    this.summary.successful_theaters++;
    this.summary.total_movies += movies;
    this.summary.total_showtimes += showtimes;
  }

  incrementFailedTheater(): void {
    this.summary.failed_theaters++;
  }

  markRateLimited(): void {
    this.summary.status = 'rate_limited';
  }

  setTotals(theaters: number, dates: number): void {
    this.summary.total_theaters = theaters;
    this.summary.total_dates = dates;
  }

  setDuration(ms: number): void {
    this.summary.duration_ms = ms;
  }

  async emit(event: ProgressEvent): Promise<void> {
    await this.progress?.emit(event);
  }

  async prepare(options?: ScrapeOptions): Promise<PrepareResult> {
    let theaters = await getTheaterConfigs(this.db);

    if (options?.theaterId) {
      const allTheatersFromDb = await getTheaters(this.db);
      const theaterExistsInDb = allTheatersFromDb.some(
        (c: Theater) => c.id === options.theaterId
      );

      if (!theaterExistsInDb) {
        throw new Error(`Theater not found in database: ${options.theaterId}`);
      }

      const foundTheater = theaters.find(c => c.id === options.theaterId);
      if (!foundTheater) {
        throw new Error(`Theater not configured for scraping: ${options.theaterId}`);
      }

      theaters = [foundTheater];
      logger.info(`Scraping only theater: ${foundTheater.name} (${foundTheater.id})`);
    }

    const scrapeMode = options?.mode ?? this.config.scrapeMode;
    const scrapeDays = options?.days || this.config.scrapeDays;
    const dates = getScrapeDates(scrapeMode, scrapeDays);

    if (options?.resumeMode && options.pendingAttempts) {
      // Keep only the theaters with a pending pair in this run's dates, so the
      // totals, the progress events and the delays leave the others out.
      theaters = theaters.filter(t => this.plannedDates(t, dates, options).length > 0);
      logger.info('Resume mode: restricted to theaters with pending dates in the scrape window', {
        count: theaters.length,
      });
    }

    logger.info('Theaters loaded', { count: theaters.length });

    logger.info('Scrape config', { mode: scrapeMode, dates: dates.length, scrapeDays });
    logger.info('Delay config', {
      theaterDelayMs: this.config.theaterDelayMs,
      movieDelayMs: this.config.movieDelayMs,
    });

    this.setTotals(theaters.length, dates.length);

    await this.emit({
      type: 'started',
      total_theaters: theaters.length,
      total_dates: dates.length,
    });

    return { theaters, dates, scrapeMode, scrapeDays };
  }

  async runTheater(
    theater: TheaterConfig,
    index: number,
    theaters: TheaterConfig[],
    dates: string[],
    options?: ScrapeOptions
  ): Promise<{ rateLimited: boolean }> {
    const strategy = getStrategyBySource(theater.source || 'allocine');
    const cascade: CascadeContext = {
      allTheaters: theaters,
      theaterIndex: index,
      datesToScrape: dates,
    };

    await this.emit({
      type: 'theater_started',
      theater_name: theater.name,
      theater_id: theater.id,
      index: index + 1,
    });

    logger.info(`Processing theater using ${strategy.sourceName} strategy`, {
      theater: theater.name,
      id: theater.id,
    });

    const { availableDates, failed, failure } = await this.loadAvailability(theater);
    if (failed) {
      if (options?.reportId && failure) {
        for (const date of this.plannedDates(theater, dates, options)) {
          await this.markFailed(options.reportId, theater.id, date, failure);
        }
      }
      return { rateLimited: false };
    }

    const { finalDatesToScrape } = this.filterDates(
      theater,
      dates,
      availableDates,
      options ?? {}
    );

    let theaterMoviesCount = 0;
    let theaterShowtimesCount = 0;
    let successfulDates = 0;
    let rateLimited = false;

    for (const date of finalDatesToScrape) {
      logger.info('Attempting date', { theater: theater.name, date });
      const outcome = await this.runDate(
        theater,
        date,
        finalDatesToScrape,
        options,
        cascade
      );
      if (outcome.status === 'success') {
        theaterMoviesCount += outcome.moviesCount ?? 0;
        theaterShowtimesCount += outcome.showtimesCount ?? 0;
        successfulDates++;
      } else if (outcome.status === 'rate_limited') {
        rateLimited = true;
        break;
      }
    }

    await this.summarizeTheater(theater, {
      successfulDates,
      totalDates: finalDatesToScrape.length,
      moviesCount: theaterMoviesCount,
      showtimesCount: theaterShowtimesCount,
    });

    return { rateLimited };
  }

  async runDate(
    theater: TheaterConfig,
    date: string,
    finalDatesToScrape: string[],
    options?: ScrapeOptions,
    cascade?: CascadeContext
  ): Promise<DateOutcome> {
    const strategy = getStrategyBySource(theater.source || 'allocine');

    let attemptId: number | undefined;
    if (options?.reportId) {
      try {
        attemptId = await createScrapeAttempt(this.db, {
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
        this.db,
        theater,
        date,
        this.config.movieDelayMs,
        this
      );
      logger.info('Date scraped successfully', { date, movies: moviesCount, showtimes: showtimesCount });
      if (attemptId) {
        try {
          await updateScrapeAttempt(this.db, attemptId, {
            status: 'success',
            movies_scraped: moviesCount,
            showtimes_scraped: showtimesCount,
          });
        } catch (error) {
          logger.error('Failed to update scrape attempt', { error });
        }
      }
      return { status: 'success', moviesCount, showtimesCount };
    } catch (error) {
      if (error instanceof RateLimitError) {
        return await this.handleRateLimit({
          theater,
          date,
          finalDatesToScrape,
          options,
          cascade,
          error,
          attemptId,
        });
      }
      return await this.handleDateFailure({
        theater,
        date,
        error,
        attemptId,
      });
    }
  }

  async loadAvailability(
    theater: TheaterConfig
  ): Promise<{ availableDates: string[]; failed: boolean; failure?: AttemptFailure }> {
    const strategy = getStrategyBySource(theater.source || 'allocine');
    try {
      const meta = await strategy.loadTheaterMetadata(this.db, theater);
      return { availableDates: meta.availableDates, failed: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = classifyError(error);
      logger.error('Failed to load theater metadata', {
        theater: theater.name,
        error: errorMessage,
      });
      this.recordError({
        theater_name: theater.name,
        theater_id: theater.id,
        error: errorMessage,
        error_type: errorType,
        http_status_code: (error as any).statusCode,
      });
      this.incrementFailedTheater();
      return {
        availableDates: [],
        failed: true,
        failure: {
          error_type: errorType,
          error_message: errorMessage,
          http_status_code: (error as any).statusCode,
        },
      };
    }
  }

  filterDates(
    theater: TheaterConfig,
    dates: string[],
    availableDates: string[],
    options: ScrapeOptions
  ): FilterDatesResult {
    const datesToScrape = dates.filter(d => availableDates.includes(d));
    const skippedDates = dates.filter(d => !availableDates.includes(d));
    if (skippedDates.length > 0) {
      logger.info('Skipping dates not yet published', {
        count: skippedDates.length,
        dates: skippedDates,
      });
    }

    const finalDatesToScrape = this.plannedDates(theater, datesToScrape, options);
    if (options.resumeMode && options.pendingAttempts) {
      logger.info('Resume mode: filtered to pending attempts', {
        theater: theater.name,
        allDates: datesToScrape.length,
        pendingDates: finalDatesToScrape.length,
      });
    }

    return { datesToScrape, finalDatesToScrape, skippedDates };
  }

  async finalize(startTime: number): Promise<void> {
    this.setDuration(Date.now() - startTime);
    logger.info('Scraping completed', { summary: this.summary });
    await closeBrowser();
    await this.emit({ type: 'completed', summary: this.summary });
  }

  async handleFatalError(startTime: number, error: unknown): Promise<never> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyError(error);
    logger.error('Fatal error in scraper', { error });
    await closeBrowser();
    this.recordSystemError(errorMessage, errorType);
    this.setDuration(Date.now() - startTime);
    await this.emit({ type: 'failed', error: errorMessage });
    throw error;
  }

  private async handleRateLimit(args: {
    theater: TheaterConfig;
    date: string;
    finalDatesToScrape: string[];
    options?: ScrapeOptions;
    cascade?: CascadeContext;
    error: RateLimitError;
    attemptId: number | undefined;
  }): Promise<DateOutcome> {
    const { theater, date, finalDatesToScrape, options, cascade, error, attemptId } = args;

    logger.error('Rate limit detected - stopping all scraping', {
      theater: theater.name,
      date,
      statusCode: error.statusCode,
    });

    const errorType = classifyError(error);
    this.recordError({
      theater_name: theater.name,
      theater_id: theater.id,
      date,
      error: error.message,
      error_type: errorType,
      http_status_code: error.statusCode,
    });

    if (attemptId) {
      try {
        await updateScrapeAttempt(this.db, attemptId, {
          status: 'rate_limited',
          error_type: errorType,
          error_message: error.message,
          http_status_code: error.statusCode,
        });
      } catch (updateError) {
        logger.error('Failed to update scrape attempt', { error: updateError });
      }
    }

    if (options?.reportId) {
      const remainingDates = finalDatesToScrape.slice(finalDatesToScrape.indexOf(date) + 1);
      for (const remainingDate of remainingDates) {
        await this.markNotAttempted(options.reportId, theater.id, remainingDate);
      }
    }

    if (options?.reportId && cascade) {
      const remainingTheaters = cascade.allTheaters.slice(cascade.theaterIndex + 1);
      for (const remainingTheater of remainingTheaters) {
        for (const futureDate of this.plannedDates(remainingTheater, cascade.datesToScrape, options)) {
          await this.markNotAttempted(options.reportId, remainingTheater.id, futureDate);
        }
      }
    }

    await this.emit({
      type: 'date_failed',
      theater_name: theater.name,
      date,
      error: error.message,
    });

    this.markRateLimited();
    return { status: 'rate_limited' };
  }

  private async handleDateFailure(args: {
    theater: TheaterConfig;
    date: string;
    error: unknown;
    attemptId: number | undefined;
  }): Promise<DateOutcome> {
    const { theater, date, error, attemptId } = args;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyError(error);
    logger.error('Date scrape failed', { theater: theater.name, date, error: errorMessage });

    this.recordError({
      theater_name: theater.name,
      theater_id: theater.id,
      date,
      error: errorMessage,
      error_type: errorType,
      http_status_code: (error as any).statusCode,
    });

    if (attemptId) {
      try {
        await updateScrapeAttempt(this.db, attemptId, {
          status: 'failed',
          error_type: errorType,
          error_message: errorMessage,
          http_status_code: (error as any).statusCode,
        });
      } catch (updateError) {
        logger.error('Failed to update scrape attempt', { error: updateError });
      }
    }

    await this.emit({
      type: 'date_failed',
      theater_name: theater.name,
      date,
      error: errorMessage,
    });

    return { status: 'error' };
  }

  private async summarizeTheater(
    theater: TheaterConfig,
    counts: {
      successfulDates: number;
      totalDates: number;
      moviesCount: number;
      showtimesCount: number;
    }
  ): Promise<void> {
    const theaterFailed = counts.successfulDates === 0 && counts.totalDates > 0;
    logger.info('Theater summary', {
      theater: theater.name,
      successfulDates: counts.successfulDates,
      totalDates: counts.totalDates,
      movies: counts.moviesCount,
      showtimes: counts.showtimesCount,
    });

    if (!theaterFailed) {
      this.incrementSuccessfulTheater(counts.moviesCount, counts.showtimesCount);
      await this.emit({
        type: 'theater_completed',
        theater_name: theater.name,
        total_movies: counts.moviesCount,
      });
      return;
    }

    this.incrementFailedTheater();
    logger.error('Theater failed completely', { theater: theater.name, dates: counts.totalDates });
  }

  /**
   * The dates this run plans for a theater: every requested date, or — in
   * resume mode — only the requested dates still pending in the parent report.
   */
  private plannedDates(
    theater: TheaterConfig,
    dates: string[],
    options: ScrapeOptions
  ): string[] {
    if (!options.resumeMode || !options.pendingAttempts) return dates;
    const pending = new Set(
      options.pendingAttempts.filter(a => a.theater_id === theater.id).map(a => a.date)
    );
    return dates.filter(d => pending.has(d));
  }

  private async markFailed(
    reportId: number,
    theaterId: string,
    date: string,
    failure: AttemptFailure
  ): Promise<void> {
    try {
      const attemptId = await createScrapeAttempt(this.db, {
        report_id: reportId,
        theater_id: theaterId,
        date,
        status: 'failed',
      });
      await updateScrapeAttempt(this.db, attemptId, { status: 'failed', ...failure });
    } catch (error) {
      logger.error('Failed to mark attempt as failed', { error });
    }
  }

  private async markNotAttempted(
    reportId: number,
    theaterId: string,
    date: string
  ): Promise<void> {
    try {
      await createScrapeAttempt(this.db, {
        report_id: reportId,
        theater_id: theaterId,
        date,
        status: 'not_attempted',
      });
    } catch (error) {
      logger.error('Failed to mark attempt as not_attempted', { error });
    }
  }
}
