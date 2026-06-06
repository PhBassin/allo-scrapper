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

  try {
    let theaters = await getTheaterConfigs(db);
    
    // Filter to specific theater if provided
    if (options?.theaterId) {
      // First verify theater exists in database (source of truth)
      const allTheatersFromDb = await getTheaters(db);
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

    const scrapeMode = options?.mode ?? (process.env.SCRAPE_MODE as ScrapeMode) ?? 'from_today_limited';
    const scrapeDays = options?.days || parseInt(process.env.SCRAPE_DAYS || '7', 10);
    const dates = getScrapeDates(scrapeMode, scrapeDays);
    logger.info('Scrape config', { mode: scrapeMode, dates: dates.length, scrapeDays });
    logger.info('Delay config', { theaterDelayMs, movieDelayMs });

    summary.total_theaters = theaters.length;
    summary.total_dates = dates.length;

    await progress?.emit({
      type: 'started',
      total_theaters: theaters.length,
      total_dates: dates.length,
    });

    for (let i = 0; i < theaters.length; i++) {
      const theater = theaters[i];
      const strategy = getStrategyBySource(theater.source || 'allocine');

      await progress?.emit({
        type: 'theater_started',
        theater_name: theater.name,
        theater_id: theater.id,
        index: i + 1,
      });

      let theaterMoviesCount = 0;
      let theaterShowtimesCount = 0;
      let successfulDates = 0;

      logger.info(`Processing theater using ${strategy.sourceName} strategy`, { theater: theater.name, id: theater.id });

      let availableDates: string[] = [];
      try {
        const meta = await strategy.loadTheaterMetadata(db, theater);
        availableDates = meta.availableDates;
      } catch (error) {
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
        continue;
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

      // Track if rate limited to stop scraping entirely
      let rateLimited = false;

      for (const date of finalDatesToScrape) {
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
          const { moviesCount, showtimesCount } = await strategy.scrapeTheater(db, theater, date, movieDelayMs, progress);
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
        } catch (error) {
          // Detect rate limiting and stop immediately
          if (error instanceof RateLimitError) {
            logger.error('Rate limit detected - stopping all scraping', { 
              theater: theater.name, 
              date, 
              statusCode: error.statusCode 
            });
            
            const errorType = classifyError(error);
            summary.errors.push({
              theater_name: theater.name,
              theater_id: theater.id,
              date: date,
              error: error.message,
              error_type: errorType,
              http_status_code: error.statusCode,
            });

            // Update attempt as rate_limited
            if (attemptId) {
              try {
                await updateScrapeAttempt(db, attemptId, {
                  status: 'rate_limited',
                  error_type: errorType,
                  error_message: error.message,
                  http_status_code: error.statusCode,
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
              
              // Mark remaining theaters and all their dates as not_attempted
              const remainingTheaters = theaters.slice(i + 1);
              for (const remainingTheater of remainingTheaters) {
                for (const futureDate of datesToScrape) {
                  try {
                    await createScrapeAttempt(db, {
                      report_id: options.reportId,
                      theater_id: remainingTheater.id,
                      date: futureDate,
                      status: 'not_attempted',
                    });
                  } catch (error) {
                    logger.error('Failed to mark attempt as not_attempted', { error });
                  }
                }
              }
            }

            await progress?.emit({
              type: 'date_failed',
              theater_name: theater.name,
              date: date,
              error: error.message
            });

            // Mark status as rate_limited and break out of both loops
            summary.status = 'rate_limited';
            rateLimited = true;
            break;
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

      // If rate limited, stop processing remaining theaters
      if (rateLimited) {
        logger.warn('Stopping scrape due to rate limit', { 
          processedTheaters: i + 1, 
          totalTheaters: theaters.length 
        });
        break;
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

      // Apply delay between theaters (except after the last one)
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
