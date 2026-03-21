import { type DB } from '../../db/client.js';
import {
  upsertShowtimes,
  upsertWeeklyPrograms,
} from '../../db/showtime-queries.js';
import {
  upsertFilm,
  getFilm,
  getFilmsBatch,
  upsertFilmsBatch,
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
    progress?: ProgressPublisher,
    processedFilmIds?: Set<number>
  ): Promise<{ filmsCount: number; showtimesCount: number }> {
    logger.info('Scraping cinema for date', { cinema: cinema.name, id: cinema.id, date });

    await progress?.emit({ type: 'date_started', date, cinema_name: cinema.name });

    let filmsCount = 0;
    let showtimesCount = 0;

    try {
      const json = await fetchShowtimesJson(cinema.id, date);
      const filmShowtimesData = parseShowtimesJson(json, cinema.id, date);

      logger.info('Films found for date', { count: filmShowtimesData.length, date });

      // Batch-fetch existing films from DB to avoid N+1 queries (#595)
      const filmIdsToLookup = filmShowtimesData
        .map(fd => fd.film.id)
        .filter(id => !(processedFilmIds?.has(id)));
      const existingFilmsMap = filmIdsToLookup.length > 0
        ? await getFilmsBatch(db, filmIdsToLookup)
        : new Map<number, import('../../types/scraper.js').Film>();

      const weeklyPrograms: WeeklyProgram[] = [];
      const filmsToUpsert: import('../../types/scraper.js').Film[] = [];
      const showtimesToUpsert: import('../../types/scraper.js').Showtime[] = [];

      for (const filmData of filmShowtimesData) {
        const film = filmData.film;

        await progress?.emit({ type: 'film_started', film_title: film.title, film_id: film.id });

        try {
          // Skip film detail fetch if already processed for this cinema run (#594)
          const alreadyProcessed = processedFilmIds?.has(film.id) ?? false;

          if (!alreadyProcessed) {
            // Check if JSON API already provided duration (#596) —
            // if so, skip the expensive fetchFilmPage call
            const hasRuntimeFromJson = film.duration_minutes !== undefined && film.duration_minutes > 0;

            if (!hasRuntimeFromJson) {
              const existingFilm = existingFilmsMap.get(film.id);

              if (!existingFilm || !existingFilm.duration_minutes) {
                logger.info('Fetching film details', { title: film.title, id: film.id });

                try {
                  const filmHtml = await fetchFilmPage(film.id);
                  const filmPageData = parseFilmPage(filmHtml);

                  if (filmPageData.duration_minutes) {
                    film.duration_minutes = filmPageData.duration_minutes;
                  }

                  await delay(movieDelayMs);
                } catch (error) {
                  logger.warn('Error fetching film page', { filmId: film.id, error });
                }
              } else {
                film.duration_minutes = existingFilm.duration_minutes;
              }
            } else {
              logger.info('Runtime already in JSON, skipping film page fetch', {
                title: film.title,
                id: film.id,
                duration: film.duration_minutes,
              });
            }

            // Mark as processed for subsequent dates
            processedFilmIds?.add(film.id);
          } else {
            logger.info('Film already processed, skipping detail fetch', {
              title: film.title,
              id: film.id,
            });
          }

          filmsToUpsert.push(film);
          showtimesToUpsert.push(...filmData.showtimes);

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
          // Note: Failed films are excluded from batch insertion (not added to arrays)
        }
      }

      // CRITICAL: Insert films before showtimes to satisfy FK constraint.
      // Showtimes reference films.id, so films must exist first.
      if (filmsToUpsert.length > 0) {
        await upsertFilmsBatch(db, filmsToUpsert);
        logger.info('Films batch upserted', { count: filmsToUpsert.length });
      }

      if (showtimesToUpsert.length > 0) {
        await upsertShowtimes(db, showtimesToUpsert);
        logger.info('Showtimes batch upserted', { count: showtimesToUpsert.length });
      }

      if (weeklyPrograms.length > 0) {
        await upsertWeeklyPrograms(db, weeklyPrograms);
        logger.info('Weekly programs updated', { count: weeklyPrograms.length });
      }

      logger.info('Cinema date scraped', { cinema: cinema.name, date, films: filmShowtimesData.length });
      await progress?.emit({ type: 'date_completed', date, films_count: filmsCount });

      return { filmsCount, showtimesCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error scraping cinema for date', { cinema: cinema.name, date, error });
      throw new Error(errorMessage);
    }
  }
}
