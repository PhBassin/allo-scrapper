import { db, type DB } from '../../db/client.js';
import {
  upsertCinema,
  upsertFilm,
  upsertShowtimes,
  upsertWeeklyPrograms,
  getFilm,
  getCinemaConfigs,
} from '../../db/queries.js';
import { fetchTheaterPage, fetchShowtimesJson, fetchFilmPage, delay, closeBrowser } from './http-client.js';
import { parseTheaterPage } from './theater-parser.js';
import { parseShowtimesJson } from './theater-json-parser.js';
import { parseFilmPage } from './film-parser.js';
import { getScrapeDates, getWeekStartForDate, type ScrapeMode } from '../../utils/date.js';
import { extractCinemaIdFromUrl, cleanCinemaUrl, isValidAllocineUrl } from './utils.js';
import type { ProgressTracker, ScrapeSummary } from '../progress-tracker.js';
import type { CinemaConfig, WeeklyProgram, Cinema } from '../../types/scraper.js';
import { logger } from '../../utils/logger.js';

/**
 * Load the theater page once to extract metadata (cinema name, city, etc.)
 * and the list of dates that actually have published showtimes.
 */
export async function loadTheaterMetadata(
  db: DB,
  cinemaConfig: CinemaConfig
): Promise<{ availableDates: string[]; cinema: Cinema }> {
  const { html, availableDates } = await fetchTheaterPage(cinemaConfig.url);

  // Parse cinema metadata from the initial HTML and upsert into DB
  const pageData = parseTheaterPage(html, cinemaConfig.id);
  
  // Ensure we keep the URL from the config, as it's not present in the HTML
  const cinema = {
    ...pageData.cinema,
    url: cinemaConfig.url
  };
  
  await upsertCinema(db, cinema);
  logger.info(`✅ Cinema ${cinema.name} metadata upserted`);

  return { availableDates, cinema };
}

// Scraper un cinéma pour une date donnée
async function scrapeTheater(
  db: DB,
  cinema: CinemaConfig,
  date: string,
  movieDelayMs: number,
  progress?: ProgressTracker
): Promise<{ filmsCount: number; showtimesCount: number }> {
  logger.info(`\n📍 Scraping ${cinema.name} (${cinema.id}) for ${date}...`);

  progress?.emit({ type: 'date_started', date, cinema_name: cinema.name });

  let filmsCount = 0;
  let showtimesCount = 0;

  try {
    // Fetch the per-date JSON from the internal API (plain HTTP, no browser)
    const json = await fetchShowtimesJson(cinema.id, date);
    const filmShowtimesData = parseShowtimesJson(json, cinema.id, date);

    logger.info(`  📊 Found ${filmShowtimesData.length} film(s) for ${date}`);

    const weeklyPrograms: WeeklyProgram[] = [];

    // Traiter chaque film
    for (const filmData of filmShowtimesData) {
      const film = filmData.film;

      progress?.emit({ type: 'film_started', film_title: film.title, film_id: film.id });

      try {
        // Vérifier si le film existe déjà et a une durée
        const existingFilm = await getFilm(db, film.id);

        if (!existingFilm || !existingFilm.duration_minutes) {
          logger.info(`  🎬 Fetching film details for "${film.title}" (${film.id})...`);

          try {
            const filmHtml = await fetchFilmPage(film.id);
            const filmPageData = parseFilmPage(filmHtml);

            if (filmPageData.duration_minutes) {
              film.duration_minutes = filmPageData.duration_minutes;
            }

            await delay(movieDelayMs); // Délai pour éviter le rate limiting
          } catch (error) {
            logger.error(`  ⚠️  Error fetching film page for ${film.id}:`, error);
          }
        } else {
          film.duration_minutes = existingFilm.duration_minutes;
        }

        // Insérer/mettre à jour le film
        await upsertFilm(db, film);
        logger.info(`  ✅ Film "${film.title}" updated`);

        // Insérer/mettre à jour les séances
        await upsertShowtimes(db, filmData.showtimes);
        logger.info(`  ✅ ${filmData.showtimes.length} showtimes updated`);

        weeklyPrograms.push({
          cinema_id: cinema.id,
          film_id: film.id,
          week_start: filmData.showtimes[0]?.week_start ?? getWeekStartForDate(date),
          is_new_this_week: filmData.is_new_this_week,
          scraped_at: new Date().toISOString(),
        });

        filmsCount++;
        showtimesCount += filmData.showtimes.length;

        progress?.emit({
          type: 'film_completed',
          film_title: film.title,
          showtimes_count: filmData.showtimes.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`  ❌ Error processing film "${film.title}":`, error);
        progress?.emit({ type: 'film_failed', film_title: film.title, error: errorMessage });
      }
    }

    // Insérer/mettre à jour les programmes hebdomadaires en lot
    if (weeklyPrograms.length > 0) {
      await upsertWeeklyPrograms(db, weeklyPrograms);
      logger.info(`  ✅ Weekly programs updated for ${weeklyPrograms.length} films`);
    }

    logger.info(`✅ Scraped ${filmShowtimesData.length} films from ${cinema.name} for ${date}`);
    progress?.emit({ type: 'date_completed', date, films_count: filmsCount });

    return { filmsCount, showtimesCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Error scraping ${cinema.name} for ${date}:`, error);
    throw new Error(errorMessage);
  }
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
  cinemaId?: string;
  filmId?: number;
}

// Run the full scraper with progress tracking
export async function addCinemaAndScrape(
  url: string,
  progress?: ProgressTracker
): Promise<Cinema> {
  // 1. Validate URL first!
  if (!isValidAllocineUrl(url)) {
    throw new Error('Invalid Allocine URL. Must be https://www.allocine.fr/...');
  }

  // 2. Extract ID and clean URL
  const cinemaId = extractCinemaIdFromUrl(url);
  if (!cinemaId) {
    throw new Error(
      'Could not extract cinema ID from URL. URL format should be like https://www.allocine.fr/seance/salle_affich-salle=C0013.html'
    );
  }

  const cleanedUrl = cleanCinemaUrl(url);

  // 3. Prepare temp config
  const tempConfig: CinemaConfig = {
    id: cinemaId,
    url: cleanedUrl,
    name: 'New Cinema', // Will be updated by loadTheaterMetadata
  };

  // 3. Load metadata (fetches page, parses it, and upserts cinema)
  logger.info(`\n🆕 Adding new cinema from ${url}...`);
  const { availableDates, cinema } = await loadTheaterMetadata(db, tempConfig);

  // 4. Scrape available dates
  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);
  logger.info(`   📅 Scraping ${availableDates.length} available date(s)...`);
  for (const date of availableDates) {
    try {
      await scrapeTheater(db, tempConfig, date, movieDelayMs, progress);
    } catch (error) {
      logger.error(`   ❌ Failed to scrape date ${date}:`, error);
      // Continue with other dates
    }
  }

  await closeBrowser();

  logger.info('✅ Cinema added successfully');

  return cinema;
}

export async function runScraper(
  progress?: ProgressTracker,
  options?: ScrapeOptions
): Promise<ScrapeSummary> {
  logger.info('🚀 Starting Allo-Scrapper...\n');

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

  // Read delay configuration from environment
  const theaterDelayMs = parseInt(process.env.SCRAPE_THEATER_DELAY_MS || '3000', 10);
  const movieDelayMs = parseInt(process.env.SCRAPE_MOVIE_DELAY_MS || '500', 10);

  try {
    // Charger la configuration des cinémas depuis la base de données
    let cinemas = await getCinemaConfigs(db);
    
    // Filter by cinemaId if provided
    if (options?.cinemaId) {
      cinemas = cinemas.filter(c => c.id === options.cinemaId);
      if (cinemas.length === 0) {
        throw new Error(`Cinema with ID ${options.cinemaId} not found in configuration`);
      }
      logger.info(`🎯 Filtering to specific cinema: ${options.cinemaId}\n`);
    }
    
    logger.info(`📋 Loaded ${cinemas.length} cinema(s) from database\n`);

    // Déterminer les dates à scraper
    const scrapeMode = options?.mode ?? (process.env.SCRAPE_MODE as ScrapeMode) ?? 'from_today_limited';
    const scrapeDays = options?.days || parseInt(process.env.SCRAPE_DAYS || '7', 10);
    const dates = getScrapeDates(scrapeMode, scrapeDays);
    logger.info(`📅 Mode: ${scrapeMode}, Scraping ${dates.length} date(s) (SCRAPE_DAYS=${scrapeDays}): ${dates.join(', ')}\n`);
    logger.info(`⏱️  Delays: ${theaterDelayMs}ms between cinemas, ${movieDelayMs}ms between films\n`);

    summary.total_cinemas = cinemas.length;
    summary.total_dates = dates.length;

    // Emit started event
    progress?.emit({
      type: 'started',
      total_cinemas: cinemas.length,
      total_dates: dates.length,
    });

    // Scraper chaque cinéma pour chaque date
    for (let i = 0; i < cinemas.length; i++) {
      const cinema = cinemas[i];

      progress?.emit({
        type: 'cinema_started',
        cinema_name: cinema.name,
        cinema_id: cinema.id,
        index: i + 1,
      });

      let cinemaFilmsCount = 0;
      let cinemaShowtimesCount = 0;
      let successfulDates = 0;

      logger.info(`\n🎬 Processing ${cinema.name} (${cinema.id})...`);

      // Step 1: Load theater page once to get metadata + available dates
      let availableDates: string[] = [];
      try {
        const meta = await loadTheaterMetadata(db, cinema);
        availableDates = meta.availableDates;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Failed to load theater metadata for ${cinema.name}:`, errorMessage);
        summary.errors.push({ cinema_name: cinema.name, error: errorMessage });
        summary.failed_cinemas++;
        continue;
      }

      // Intersect requested dates with actually-available dates from the page
      const datesToScrape = dates.filter(d => availableDates.includes(d));
      const skippedDates = dates.filter(d => !availableDates.includes(d));

      if (skippedDates.length > 0) {
        logger.info(`   ⏭️  Skipping ${skippedDates.length} date(s) not yet published: ${skippedDates.join(', ')}`);
      }
      logger.info(`   📅 Scraping ${datesToScrape.length} date(s): ${datesToScrape.join(', ')}`);

      // Step 2: Fetch showtimes JSON for each available date
      for (const date of datesToScrape) {
        logger.info(`\n   📅 Attempting date: ${date}`);
        try {
          const { filmsCount, showtimesCount } = await scrapeTheater(db, cinema, date, movieDelayMs, progress);
          cinemaFilmsCount += filmsCount;
          cinemaShowtimesCount += showtimesCount;
          successfulDates++;
          logger.info(`   ✅ Date ${date} completed: ${filmsCount} films, ${showtimesCount} showtimes`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`   ❌ Date ${date} failed:`, errorMessage);
          summary.errors.push({ 
            cinema_name: cinema.name, 
            date: date,
            error: errorMessage 
          });
          
          progress?.emit({ 
            type: 'date_failed',
            cinema_name: cinema.name, 
            date: date,
            error: errorMessage 
          });
          
          continue; // Skip to next date for this cinema
        }
      }

      const cinemaFailed = successfulDates === 0 && datesToScrape.length > 0;

      logger.info(`\n📊 ${cinema.name} summary: ${successfulDates}/${datesToScrape.length} dates successful, ${cinemaFilmsCount} films, ${cinemaShowtimesCount} showtimes`);

      if (!cinemaFailed) {
        summary.successful_cinemas++;
        summary.total_films += cinemaFilmsCount;
        summary.total_showtimes += cinemaShowtimesCount;
        progress?.emit({
          type: 'cinema_completed',
          cinema_name: cinema.name,
          total_films: cinemaFilmsCount,
        });
      } else {
        summary.failed_cinemas++;
        logger.error(`❌ ${cinema.name} failed completely (0/${datesToScrape.length} dates successful)`);
      }

      // Apply delay between cinemas (except after the last one)
      if (i < cinemas.length - 1) {
        logger.info(`⏸️  Waiting ${theaterDelayMs}ms before next cinema...`);
        await delay(theaterDelayMs);
      }
    }

    logger.info('\n✨ Scraping completed!');
    await closeBrowser();
    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Fatal error:', error);
    await closeBrowser();
    summary.errors.push({ cinema_name: 'System', error: errorMessage });
    throw error;
  }
}
