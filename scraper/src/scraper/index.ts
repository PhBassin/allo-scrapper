import { db, type DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  getCinemaConfigs,
  getCinemas,
} from '../db/cinema-queries.js';
import { closeBrowser, delay } from './http-client.js';
import { getScrapeDates, type ScrapeMode } from '../utils/date.js';
import type { CinemaConfig, Cinema, ProgressEvent, ScrapeSummary } from '../types/scraper.js';
import { getStrategyByUrl, getStrategyBySource } from './strategy-factory.js';

// Progress publisher interface – allows injecting Redis publisher or a no-op
export interface ProgressPublisher {
  emit(event: ProgressEvent): Promise<void>;
}

// No-op publisher for standalone use
export class NoopProgressPublisher implements ProgressPublisher {
  async emit(_event: ProgressEvent): Promise<void> {}
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
}

export async function runScraper(
  progress?: ProgressPublisher,
  options?: ScrapeOptions
): Promise<ScrapeSummary> {
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

  try {
    let cinemas = await getCinemaConfigs(db);
    
    // Filter to specific cinema if provided
    if (options?.cinemaId) {
      // First verify cinema exists in database (source of truth)
      const allCinemasFromDb = await getCinemas(db);
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

    const scrapeMode = options?.mode ?? (process.env.SCRAPE_MODE as ScrapeMode) ?? 'from_today_limited';
    const scrapeDays = options?.days || parseInt(process.env.SCRAPE_DAYS || '7', 10);
    const dates = getScrapeDates(scrapeMode, scrapeDays);
    logger.info('Scrape config', { mode: scrapeMode, dates: dates.length, scrapeDays });
    logger.info('Delay config', { theaterDelayMs, movieDelayMs });

    summary.total_cinemas = cinemas.length;
    summary.total_dates = dates.length;

    await progress?.emit({
      type: 'started',
      total_cinemas: cinemas.length,
      total_dates: dates.length,
    });

    for (let i = 0; i < cinemas.length; i++) {
      const cinema = cinemas[i];
      const strategy = getStrategyBySource(cinema.source || 'allocine');

      await progress?.emit({
        type: 'cinema_started',
        cinema_name: cinema.name,
        cinema_id: cinema.id,
        index: i + 1,
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to load theater metadata', { cinema: cinema.name, error: errorMessage });
        summary.errors.push({ cinema_name: cinema.name, error: errorMessage });
        summary.failed_cinemas++;
        continue;
      }

      const datesToScrape = dates.filter(d => availableDates.includes(d));
      const skippedDates = dates.filter(d => !availableDates.includes(d));

      if (skippedDates.length > 0) {
        logger.info('Skipping dates not yet published', { count: skippedDates.length, dates: skippedDates });
      }
      logger.info('Dates to scrape', { cinema: cinema.name, count: datesToScrape.length });

      for (const date of datesToScrape) {
        logger.info('Attempting date', { cinema: cinema.name, date });
        try {
          const { filmsCount, showtimesCount } = await strategy.scrapeTheater(db, cinema, date, movieDelayMs, progress);
          cinemaFilmsCount += filmsCount;
          cinemaShowtimesCount += showtimesCount;
          successfulDates++;
          logger.info('Date scraped successfully', { date, films: filmsCount, showtimes: showtimesCount });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Date scrape failed', { cinema: cinema.name, date, error: errorMessage });
          summary.errors.push({
            cinema_name: cinema.name,
            date: date,
            error: errorMessage
          });

          await progress?.emit({
            type: 'date_failed',
            cinema_name: cinema.name,
            date: date,
            error: errorMessage
          });

          continue;
        }
      }

      const cinemaFailed = successfulDates === 0 && datesToScrape.length > 0;

      logger.info('Cinema summary', {
        cinema: cinema.name,
        successfulDates,
        totalDates: datesToScrape.length,
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
        logger.error('Cinema failed completely', { cinema: cinema.name, dates: datesToScrape.length });
      }

      // Apply delay between cinemas (except after the last one)
      if (i < cinemas.length - 1) {
        logger.info('Waiting before next cinema', { delayMs: theaterDelayMs });
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
    logger.error('Fatal error in scraper', { error });
    await closeBrowser();
    summary.errors.push({ cinema_name: 'System', error: errorMessage });
    summary.duration_ms = Date.now() - startTime;
    await progress?.emit({ type: 'failed', error: errorMessage });
    throw error;
  }
}
