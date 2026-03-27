import { type DB } from '../../db/client.js';
import {
  upsertShowtimes,
  upsertWeeklyPrograms,
} from '../../db/showtime-queries.js';
import {
  upsertFilm,
  getFilm,
} from '../../db/film-queries.js';
import {
  upsertCinema,
} from '../../db/cinema-queries.js';
import { fetchTheaterPage, fetchShowtimesJson, fetchFilmPage, delay } from '../http-client.js';
import { parseTheaterPage } from '../theater-parser.js';
import { parseShowtimesJson } from '../theater-json-parser.js';
import { parseFilmPage } from '../film-parser.js';
import { getWeekStartForDate } from '../../utils/date.js';
import { isValidAllocineUrl, extractCinemaIdFromUrl, cleanCinemaUrl } from '../utils.js';
import { logger } from '../../utils/logger.js';
import type { CinemaConfig, WeeklyProgram, Cinema } from '../../types/scraper.js';
import { type ProgressPublisher } from '../index.js';
import { type IScraperStrategy } from './IScraperStrategy.js';
import { RateLimitError } from '../../utils/errors.js';

export class AllocineScraperStrategy implements IScraperStrategy {
  readonly sourceName = 'allocine';

  canHandleUrl(url: string): boolean {
    return isValidAllocineUrl(url);
  }

  extractCinemaId(url: string): string | null {
    return extractCinemaIdFromUrl(url);
  }

  cleanCinemaUrl(url: string): string {
    return cleanCinemaUrl(url);
  }

  async loadTheaterMetadata(
    db: DB,
    cinema: CinemaConfig
  ): Promise<{ availableDates: string[]; cinema: Cinema }> {
    const { html, availableDates } = await fetchTheaterPage(cinema.url);

    const pageData = parseTheaterPage(html, cinema.id);
    const mergedCinema: Cinema = { 
      ...pageData.cinema, 
      url: cinema.url,
      source: this.sourceName
    };
    await upsertCinema(db, mergedCinema);
    logger.info('Cinema metadata upserted', { cinema: mergedCinema.name });

    return { availableDates, cinema: mergedCinema };
  }

  async scrapeTheater(
    db: DB,
    cinema: CinemaConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher
  ): Promise<{ filmsCount: number; showtimesCount: number }> {
    logger.info('Scraping cinema for date', { cinema: cinema.name, id: cinema.id, date });

    await progress?.emit({ type: 'date_started', date, cinema_name: cinema.name });

    let filmsCount = 0;
    let showtimesCount = 0;

    try {
      const json = await fetchShowtimesJson(cinema.id, date);
      const filmShowtimesData = parseShowtimesJson(json, cinema.id, date);

      logger.info('Films found for date', { count: filmShowtimesData.length, date });

      const weeklyPrograms: WeeklyProgram[] = [];

      for (const filmData of filmShowtimesData) {
        const film = filmData.film;

        await progress?.emit({ type: 'film_started', film_title: film.title, film_id: film.id });

        try {
          const existingFilm = await getFilm(db, film.id);
          const needsDuration = !existingFilm?.duration_minutes;
          const needsDirector = !existingFilm?.director;
          const needsScreenwriters = !existingFilm?.screenwriters || existingFilm.screenwriters.length === 0;

          if (!existingFilm || needsDuration || needsDirector || needsScreenwriters) {
            logger.info('Fetching film details', { title: film.title, id: film.id });

            try {
              const filmHtml = await fetchFilmPage(film.id);
              const filmPageData = parseFilmPage(filmHtml);

              if (filmPageData.duration_minutes) {
                film.duration_minutes = filmPageData.duration_minutes;
              }

              if (filmPageData.director) {
                film.director = filmPageData.director;
              }

              if (filmPageData.screenwriters && filmPageData.screenwriters.length > 0) {
                film.screenwriters = filmPageData.screenwriters;
              }

              await delay(movieDelayMs);
            } catch (error) {
              logger.warn('Error fetching film page', { filmId: film.id, error });
            }
          } else {
            film.duration_minutes = existingFilm.duration_minutes;
            film.director = existingFilm.director;
            film.screenwriters = existingFilm.screenwriters;
          }

          await upsertFilm(db, film);
          logger.info('Film upserted', { title: film.title });

          await upsertShowtimes(db, filmData.showtimes);
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

      logger.info('Cinema date scraped', { cinema: cinema.name, date, films: filmShowtimesData.length });
      await progress?.emit({ type: 'date_completed', date, films_count: filmsCount });

      return { filmsCount, showtimesCount };
    } catch (error) {
      // Re-throw RateLimitError immediately for scraper to handle
      if (error instanceof RateLimitError) {
        logger.error('Rate limit detected - stopping scrape', { cinema: cinema.name, date, error });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error scraping cinema for date', { cinema: cinema.name, date, error });
      throw new Error(errorMessage);
    }
  }
}
