import { db, type DB } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  upsertCinema,
  upsertFilm,
  upsertShowtime,
  upsertWeeklyPrograms,
  getFilm,
  getCinemaConfigs,
} from '../db/queries.js';
import { fetchTheaterPage, fetchShowtimesJson, fetchFilmPage, delay, closeBrowser } from './http-client.js';
import { parseTheaterPage } from './theater-parser.js';
import { parseShowtimesJson } from './theater-json-parser.js';
import { parseFilmPage } from './film-parser.js';
import { getScrapeDates, getWeekStartForDate, type ScrapeMode } from '../utils/date.js';
import type { CinemaConfig, WeeklyProgram, Cinema, ProgressEvent, ScrapeSummary } from '../types/scraper.js';

// Progress publisher interface – allows injecting Redis publisher or a no-op
export interface ProgressPublisher {
  emit(event: ProgressEvent): Promise<void>;
}

// No-op publisher for standalone use
export class NoopProgressPublisher implements ProgressPublisher {
  async emit(_event: ProgressEvent): Promise<void> {}
}

/**
 * Load the theater page once to extract metadata (cinema name, city, etc.)
 * and the list of dates that actually have published showtimes.
 */
async function loadTheaterMetadata(
  db: DB,
  cinema: CinemaConfig
): Promise<{ availableDates: string[]; cinema: Cinema }> {
  const { html, availableDates } = await fetchTheaterPage(cinema.url);

  const pageData = parseTheaterPage(html, cinema.id);
  await upsertCinema(db, pageData.cinema);
  logger.info('Cinema metadata upserted', { cinema: pageData.cinema.name });

  return { availableDates, cinema: pageData.cinema };
}

// Scraper un cinéma pour une date donnée
async function scrapeTheater(
  db: DB,
  cinema: CinemaConfig,
  date: string,
  progress?: ProgressPublisher,
  filmId?: number
): Promise<{ filmsCount: number; showtimesCount: number }> {
  logger.info('Scraping cinema for date', { cinema: cinema.name, id: cinema.id, date });

  await progress?.emit({ type: 'date_started', date, cinema_name: cinema.name });

  let filmsCount = 0;
  let showtimesCount = 0;

  try {
    const json = await fetchShowtimesJson(cinema.id, date);
    const filmShowtimesData = parseShowtimesJson(json, cinema.id, date);
    const filteredFilmShowtimesData = filmId
      ? filmShowtimesData.filter(({ film }) => film.id === filmId)
      : filmShowtimesData;

    logger.info('Films found for date', { count: filteredFilmShowtimesData.length, date });

    const weeklyPrograms: WeeklyProgram[] = [];

    for (const filmData of filteredFilmShowtimesData) {
      const film = filmData.film;

      await progress?.emit({ type: 'film_started', film_title: film.title, film_id: film.id });

      try {
        const existingFilm = await getFilm(db, film.id);

        if (!existingFilm || !existingFilm.duration_minutes) {
          logger.info('Fetching film details', { title: film.title, id: film.id });

          try {
            const filmHtml = await fetchFilmPage(film.id);
            const filmPageData = parseFilmPage(filmHtml);

            if (filmPageData.duration_minutes) {
              film.duration_minutes = filmPageData.duration_minutes;
            }

            await delay(500);
          } catch (error) {
            logger.warn('Error fetching film page', { filmId: film.id, error });
          }
        } else {
          film.duration_minutes = existingFilm.duration_minutes;
        }

        await upsertFilm(db, film);
        logger.info('Film upserted', { title: film.title });

        for (const showtime of filmData.showtimes) {
          await upsertShowtime(db, showtime);
        }
        logger.info('Showtimes upserted', { count: filmData.showtimes.length });

        weeklyPrograms.push({
          cinema_id: cinema.id,
          film_id: film.id,
          week_start: filmData.showtimes[0]?.week_start ?? getWeekStartForDate(date),
          is_new_this_week: filmData.is_new_this_week,
          scraped_at: new Date().toISOString(),
        });

        filmsCount++;
        showtimesCount += filmData.showtimes.length;

        await progress?.emit({
          type: 'film_completed',
          film_title: film.title,
          showtimes_count: filmData.showtimes.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error processing film', { title: film.title, error });
        await progress?.emit({ type: 'film_failed', film_title: film.title, error: errorMessage });
      }
    }

    if (weeklyPrograms.length > 0) {
      await upsertWeeklyPrograms(db, weeklyPrograms);
      logger.info('Weekly programs updated', { count: weeklyPrograms.length });
    }

    logger.info('Cinema date scraped', { cinema: cinema.name, date, films: filteredFilmShowtimesData.length });
    await progress?.emit({ type: 'date_completed', date, films_count: filmsCount });

    return { filmsCount, showtimesCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error scraping cinema for date', { cinema: cinema.name, date, error });
    throw new Error(errorMessage);
  }
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
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

  try {
    const cinemas = await getCinemaConfigs(db);
    logger.info('Cinemas loaded', { count: cinemas.length });

    const scrapeMode = options?.mode ?? (process.env.SCRAPE_MODE as ScrapeMode) ?? 'from_today_limited';
    const scrapeDays = options?.days || parseInt(process.env.SCRAPE_DAYS || '7', 10);
    const dates = getScrapeDates(scrapeMode, scrapeDays);
    logger.info('Scrape config', { mode: scrapeMode, dates: dates.length, scrapeDays });

    summary.total_cinemas = cinemas.length;
    summary.total_dates = dates.length;

    await progress?.emit({
      type: 'started',
      total_cinemas: cinemas.length,
      total_dates: dates.length,
    });

    for (let i = 0; i < cinemas.length; i++) {
      const cinema = cinemas[i];

      await progress?.emit({
        type: 'cinema_started',
        cinema_name: cinema.name,
        cinema_id: cinema.id,
        index: i + 1,
      });

      let cinemaFilmsCount = 0;
      let cinemaShowtimesCount = 0;
      let successfulDates = 0;

      logger.info('Processing cinema', { cinema: cinema.name, id: cinema.id });

      let availableDates: string[] = [];
      try {
        const meta = await loadTheaterMetadata(db, cinema);
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
          const { filmsCount, showtimesCount } = await scrapeTheater(
            db,
            cinema,
            date,
            progress,
            options?.filmId
          );
          cinemaFilmsCount += filmsCount;
          cinemaShowtimesCount += showtimesCount;
          successfulDates++;
          logger.info('Date scraped successfully', { date, films: filmsCount, showtimes: showtimesCount });
          await delay(500);
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
