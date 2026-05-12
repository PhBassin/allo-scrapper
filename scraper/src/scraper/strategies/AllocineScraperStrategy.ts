import { type DB } from '../../db/client.js';
import {
  upsertShowtimes,
  upsertWeeklyPrograms,
} from '../../db/showtime-queries.js';
import {
  upsertMovie,
  getMovie,
  getMoviesBatch,
} from '../../db/movie-queries.js';
import {
  upsertTheater,
} from '../../db/theater-queries.js';
import { fetchTheaterPage, fetchShowtimesJson, fetchMoviePage, delay } from '../http-client.js';
import { parseTheaterPage } from '../theater-page-parser.js';
import { parseShowtimesJson } from '../theater-page-json-parser.js';
import { parseMoviePage } from '../movie-parser.js';
import { getWeekStartForDate } from '../../utils/date.js';
import { isValidAllocineUrl, extractTheaterIdFromUrl, cleanTheaterUrl } from '../utils.js';
import { logger } from '../../utils/logger.js';
import type { TheaterConfig, WeeklyProgram, Theater } from '../../types/scraper.js';
import { type ProgressPublisher } from '../index.js';
import { type IScraperStrategy } from './IScraperStrategy.js';
import { RateLimitError } from '../../utils/errors.js';
import { ParserStructureError } from '../../utils/parser-errors.js';
import { validateMoviePageStructure, validateTheaterPageStructure } from '../parser-health-check.js';

export function shouldRefreshMovieDetails(existingMovie?: {
  duration_minutes?: number;
  director?: string;
  screenwriters?: string[];
  trailer_url?: string;
} | null): boolean {
  if (!existingMovie) {
    return true;
  }

  const needsDuration = !existingMovie.duration_minutes;
  const needsDirector = !existingMovie.director;
  const needsScreenwriters = !existingMovie.screenwriters || existingMovie.screenwriters.length === 0;
  const needsTrailerUrl = !existingMovie.trailer_url;

  return needsDuration || needsDirector || needsScreenwriters || needsTrailerUrl;
}

export class AllocineScraperStrategy implements IScraperStrategy {
  readonly sourceName = 'allocine';

  canHandleUrl(url: string): boolean {
    return isValidAllocineUrl(url);
  }

  extractTheaterId(url: string): string | null {
    return extractTheaterIdFromUrl(url);
  }

  cleanTheaterUrl(url: string): string {
    return cleanTheaterUrl(url);
  }

  async loadTheaterPageMetadata(
    db: DB,
    theater: TheaterConfig
  ): Promise<{ availableDates: string[]; theater: Theater }> {
    const { html, availableDates } = await fetchTheaterPage(theater.url);
    const theaterValidation = validateTheaterPageStructure(html);

    if (!theaterValidation.valid) {
      throw new ParserStructureError(
        `Missing required theater selector(s): ${theaterValidation.missingSelectors.join(', ')}`,
        theaterValidation.missingSelectors[0] ?? '#theaterpage-showtimes-index-ui',
        theater.url
      );
    }

    const pageData = parseTheaterPage(html, theater.id);
    const mergedTheater: Theater = { 
      ...pageData.theater, 
      url: theater.url,
      source: this.sourceName
    };
    await upsertTheater(db, mergedTheater);
    logger.info('Theater metadata upserted', { theater: mergedTheater.name });

    return { availableDates, theater: mergedTheater };
  }

  async scrapeTheaterPage(
    db: DB,
    theater: TheaterConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher
  ): Promise<{ moviesCount: number; showtimesCount: number }> {
    logger.info('Scraping theater for date', { theater: theater.name, id: theater.id, date });

    await progress?.emit({ type: 'date_started', date, theater_name: theater.name });

    let moviesCount = 0;
    let showtimesCount = 0;

    try {
      const json = await fetchShowtimesJson(theater.id, date);
      const movieShowtimesData = parseShowtimesJson(json, theater.id, date);

      logger.info('Movies found for date', { count: movieShowtimesData.length, date });

      // Batch-load existing movies to avoid N+1 queries
      const movieIds = movieShowtimesData.map((f) => f.movie.id);
      const existingMovies = await getMoviesBatch(db, movieIds);

      const weeklyPrograms: WeeklyProgram[] = [];

      for (const movieData of movieShowtimesData) {
        const movie = movieData.movie;

        await progress?.emit({ type: 'movie_started', movie_title: movie.title, movie_id: movie.id });

        try {
          const existingMovie = existingMovies.get(movie.id);

          if (shouldRefreshMovieDetails(existingMovie)) {
            logger.info('Fetching movie details', { title: movie.title, id: movie.id });

            try {
              const movieHtml = await fetchMoviePage(movie.id);
              const movieValidation = validateMoviePageStructure(movieHtml);

              if (!movieValidation.valid) {
                throw new ParserStructureError(
                  `Missing required movie selector(s): ${movieValidation.missingSelectors.join(', ')}`,
                  movieValidation.missingSelectors[0] ?? '.meta-body-info',
                  movie.source_url
                );
              }

              const moviePageData = parseMoviePage(movieHtml);

              if (moviePageData.duration_minutes) {
                movie.duration_minutes = moviePageData.duration_minutes;
              }

              if (moviePageData.director) {
                movie.director = moviePageData.director;
              }

              if (moviePageData.screenwriters && moviePageData.screenwriters.length > 0) {
                movie.screenwriters = moviePageData.screenwriters;
              }

              if (moviePageData.trailer_url) {
                movie.trailer_url = moviePageData.trailer_url;
              }
            } catch (error) {
              if (error instanceof ParserStructureError) {
                throw error;
              }

              logger.warn('Error fetching movie page', { movieId: movie.id, error });
            } finally {
              await delay(movieDelayMs);
            }

            if (existingMovie) {
              movie.duration_minutes = movie.duration_minutes ?? existingMovie.duration_minutes;
              movie.director = movie.director ?? existingMovie.director;
              movie.trailer_url = movie.trailer_url ?? existingMovie.trailer_url;

              if ((!movie.screenwriters || movie.screenwriters.length === 0) &&
                existingMovie.screenwriters &&
                existingMovie.screenwriters.length > 0) {
                movie.screenwriters = existingMovie.screenwriters;
              }
            }
          } else if (existingMovie) {
            movie.duration_minutes = existingMovie.duration_minutes;
            movie.director = existingMovie.director;
            movie.screenwriters = existingMovie.screenwriters;
            movie.trailer_url = existingMovie.trailer_url;
          }

          await upsertMovie(db, movie);
          logger.info('Movie upserted', { title: movie.title });

          await upsertShowtimes(db, movieData.showtimes);
          logger.info('Showtimes upserted', { count: movieData.showtimes.length });

          weeklyPrograms.push({
            theater_id: theater.id,
            movie_id: movie.id,
            week_start: movieData.showtimes[0]?.week_start ?? getWeekStartForDate(date),
            is_new_this_week: movieData.is_new_this_week,
            scraped_at: new Date().toISOString(),
          });

          moviesCount++;
          showtimesCount += movieData.showtimes.length;

          await progress?.emit({
            type: 'movie_completed',
            movie_title: movie.title,
            showtimes_count: movieData.showtimes.length,
          });
        } catch (error) {
          if (error instanceof ParserStructureError) {
            throw error;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error processing movie', { title: movie.title, error });
          await progress?.emit({ type: 'movie_failed', movie_title: movie.title, error: errorMessage });
        }
      }

      if (weeklyPrograms.length > 0) {
        await upsertWeeklyPrograms(db, weeklyPrograms);
        logger.info('Weekly programs updated', { count: weeklyPrograms.length });
      }

      logger.info('Theater date scraped', { theater: theater.name, date, movies: movieShowtimesData.length });
      await progress?.emit({ type: 'date_completed', date, movies_count: moviesCount });

      return { moviesCount, showtimesCount };
    } catch (error) {
      // Re-throw RateLimitError immediately for scraper to handle
      if (error instanceof RateLimitError || error instanceof ParserStructureError) {
        logger.error('Rate limit detected - stopping scrape', { theater: theater.name, date, error });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error scraping theater for date', { theater: theater.name, date, error });
      throw new Error(errorMessage);
    }
  }
}
