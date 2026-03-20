import { db, type DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  getCinemaConfigs,
  getCinemas,
} from '../db/cinema-queries.js';
import { closeBrowser, delay, circuitBreaker } from './http-client.js';
import { getScrapeDates, type ScrapeMode } from '../utils/date.js';
import type { CinemaConfig, Cinema, ProgressEvent, ScrapeSummary } from '../types/scraper.js';
import { getStrategyByUrl, getStrategyBySource } from './strategy-factory.js';
import pLimit from 'p-limit';

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
  progress?: ProgressPublisher,
  processedFilmIds?: Set<number>
): Promise<{ filmsCount: number; showtimesCount: number }> {
  const strategy = getStrategyBySource(cinema.source || 'allocine');
  return strategy.scrapeTheater(db, cinema, date, movieDelayMs, progress, processedFilmIds);
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
  const dateDelayMs = parseInt(process.env.SCRAPE_DATE_DELAY_MS || '1500', 10);
  logger.info(`Scraping ${availableDates.length} available date(s)...`, { cinema: cinema.name });

  // Track processed film IDs across dates for this cinema to avoid redundant fetches
  const processedFilmIds = new Set<number>();

  for (let di = 0; di < availableDates.length; di++) {
    const date = availableDates[di];
    try {
      await strategy.scrapeTheater(db, tempConfig, date, movieDelayMs, progress, processedFilmIds);
    } catch (error) {
      logger.error('Failed to scrape date', { date, cinema: cinema.name, error });
    }

    // Apply delay between dates (except after the last one)
    if (di < availableDates.length - 1) {
      await delay(dateDelayMs);
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
  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  const dateDelayMs = parseInt(process.env.SCRAPE_DATE_DELAY_MS || '1500', 10);

  try {
    // Reset the circuit breaker at the start of each scrape run
    circuitBreaker.reset();

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
    logger.info('Delay config', { movieDelayMs, dateDelayMs });

    summary.total_cinemas = cinemas.length;
    summary.total_dates = dates.length;

    await progress?.emit({
      type: 'started',
      total_cinemas: cinemas.length,
      total_dates: dates.length,
    });

    // ── Bounded concurrency with p-limit ────────────────────────────────────
    const concurrency = parseInt(process.env.SCRAPER_CONCURRENCY || '2', 10);
    const limit = pLimit(concurrency);
    logger.info('Concurrency config', { concurrency });

    const cinemaResults = await Promise.allSettled(
      cinemas.map((cinema, i) =>
        limit(async () => {
          // Abort early if the circuit breaker has opened (upstream is down)
          if (circuitBreaker.state === 'open') {
            logger.warn('Circuit breaker is open — skipping cinema', {
              cinema: cinema.name,
              circuitFailures: circuitBreaker.failures,
            });
            return { status: 'circuit_open' as const, cinema };
          }

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
            return { status: 'metadata_failed' as const, cinema, error: errorMessage };
          }

          const datesToScrape = dates.filter(d => availableDates.includes(d));
          const skippedDates = dates.filter(d => !availableDates.includes(d));

          if (skippedDates.length > 0) {
            logger.info('Skipping dates not yet published', { count: skippedDates.length, dates: skippedDates });
          }
          logger.info('Dates to scrape', { cinema: cinema.name, count: datesToScrape.length });

          // Track processed film IDs across dates for this cinema to avoid redundant fetches
          const processedFilmIds = new Set<number>();

          for (let di = 0; di < datesToScrape.length; di++) {
            const date = datesToScrape[di];
            logger.info('Attempting date', { cinema: cinema.name, date });
            try {
              const { filmsCount, showtimesCount } = await strategy.scrapeTheater(db, cinema, date, movieDelayMs, progress, processedFilmIds);
              cinemaFilmsCount += filmsCount;
              cinemaShowtimesCount += showtimesCount;
              successfulDates++;
              logger.info('Date scraped successfully', { date, films: filmsCount, showtimes: showtimesCount });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error('Date scrape failed', { cinema: cinema.name, date, error: errorMessage });

              await progress?.emit({
                type: 'date_failed',
                cinema_name: cinema.name,
                date: date,
                error: errorMessage,
              });
            }

            // Apply delay between dates (except after the last one)
            if (di < datesToScrape.length - 1) {
              logger.info('Waiting before next date', { delayMs: dateDelayMs });
              await delay(dateDelayMs);
            }
          }

          return {
            status: 'completed' as const,
            cinema,
            cinemaFilmsCount,
            cinemaShowtimesCount,
            successfulDates,
            totalDates: datesToScrape.length,
          };
        })
      )
    );

    // ── Aggregate results ─────────────────────────────────────────────────
    let circuitOpenCount = 0;
    for (const result of cinemaResults) {
      if (result.status === 'rejected') {
        // Unexpected error (should be rare since we catch inside)
        summary.failed_cinemas++;
        summary.errors.push({
          cinema_name: 'Unknown',
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        continue;
      }

      const val = result.value;

      if (val.status === 'circuit_open') {
        circuitOpenCount++;
        continue;
      }

      if (val.status === 'metadata_failed') {
        summary.failed_cinemas++;
        summary.errors.push({ cinema_name: val.cinema.name, error: val.error });
        continue;
      }

      // status === 'completed'
      const cinemaFailed = val.successfulDates === 0 && val.totalDates > 0;

      logger.info('Cinema summary', {
        cinema: val.cinema.name,
        successfulDates: val.successfulDates,
        totalDates: val.totalDates,
        films: val.cinemaFilmsCount,
        showtimes: val.cinemaShowtimesCount,
      });

      if (!cinemaFailed) {
        summary.successful_cinemas++;
        summary.total_films += val.cinemaFilmsCount;
        summary.total_showtimes += val.cinemaShowtimesCount;
        await progress?.emit({
          type: 'cinema_completed',
          cinema_name: val.cinema.name,
          total_films: val.cinemaFilmsCount,
        });
      } else {
        summary.failed_cinemas++;
        logger.error('Cinema failed completely', { cinema: val.cinema.name, dates: val.totalDates });
      }
    }

    if (circuitOpenCount > 0) {
      logger.warn('Circuit breaker caused cinemas to be skipped', { count: circuitOpenCount });
      summary.errors.push({
        cinema_name: 'System',
        error: `Circuit breaker open — skipped ${circuitOpenCount} cinema(s)`,
      });
      summary.failed_cinemas += circuitOpenCount;
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
