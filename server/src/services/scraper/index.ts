import { db, type DB } from '../../db/client.js';
import {
  upsertCinema,
  upsertFilm,
  upsertShowtime,
  upsertWeeklyPrograms,
  getFilm,
  getCinemaConfigs,
} from '../../db/queries.js';
import { fetchTheaterPage, fetchShowtimesJson, fetchFilmPage, delay, closeBrowser } from './http-client.js';
import { parseTheaterPage } from './theater-parser.js';
import { parseShowtimesJson } from './theater-json-parser.js';
import { parseFilmPage } from './film-parser.js';
import { getScrapeDates, getWeekStartForDate, type ScrapeMode } from '../../utils/date.js';
import { extractCinemaIdFromUrl } from './utils.js';
import type { ProgressTracker, ScrapeSummary } from '../progress-tracker.js';
import type { CinemaConfig, WeeklyProgram, Cinema } from '../../types/scraper.js';

/**
 * Load the theater page once to extract metadata (cinema name, city, etc.)
 * and the list of dates that actually have published showtimes.
 */
async function loadTheaterMetadata(
  db: DB,
  cinema: CinemaConfig
): Promise<{ availableDates: string[]; cinema: Cinema }> {
  const { html, availableDates } = await fetchTheaterPage(cinema.url);

  // Parse cinema metadata from the initial HTML and upsert into DB
  const pageData = parseTheaterPage(html, cinema.id);
  await upsertCinema(db, pageData.cinema);
  console.log(`✅ Cinema ${pageData.cinema.name} metadata upserted`);

  return { availableDates, cinema: pageData.cinema };
}

// Scraper un cinéma pour une date donnée
async function scrapeTheater(
  db: DB,
  cinema: CinemaConfig,
  date: string,
  progress?: ProgressTracker
): Promise<{ filmsCount: number; showtimesCount: number }> {
  console.log(`\n📍 Scraping ${cinema.name} (${cinema.id}) for ${date}...`);

  progress?.emit({ type: 'date_started', date, cinema_name: cinema.name });

  let filmsCount = 0;
  let showtimesCount = 0;

  try {
    // Fetch the per-date JSON from the internal API (plain HTTP, no browser)
    const json = await fetchShowtimesJson(cinema.id, date);
    const filmShowtimesData = parseShowtimesJson(json, cinema.id, date);

    console.log(`  📊 Found ${filmShowtimesData.length} film(s) for ${date}`);

    const weeklyPrograms: WeeklyProgram[] = [];

    // Traiter chaque film
    for (const filmData of filmShowtimesData) {
      const film = filmData.film;

      progress?.emit({ type: 'film_started', film_title: film.title, film_id: film.id });

      try {
        // Vérifier si le film existe déjà et a une durée
        const existingFilm = await getFilm(db, film.id);

        if (!existingFilm || !existingFilm.duration_minutes) {
          console.log(`  🎬 Fetching film details for "${film.title}" (${film.id})...`);

          try {
            const filmHtml = await fetchFilmPage(film.id);
            const filmPageData = parseFilmPage(filmHtml);

            if (filmPageData.duration_minutes) {
              film.duration_minutes = filmPageData.duration_minutes;
            }

            await delay(500); // Délai pour éviter le rate limiting
          } catch (error) {
            console.error(`  ⚠️  Error fetching film page for ${film.id}:`, error);
          }
        } else {
          film.duration_minutes = existingFilm.duration_minutes;
        }

        // Insérer/mettre à jour le film
        await upsertFilm(db, film);
        console.log(`  ✅ Film "${film.title}" updated`);

        // Insérer/mettre à jour les séances
        for (const showtime of filmData.showtimes) {
          await upsertShowtime(db, showtime);
        }
        console.log(`  ✅ ${filmData.showtimes.length} showtimes updated`);

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
        console.error(`  ❌ Error processing film "${film.title}":`, error);
        progress?.emit({ type: 'film_failed', film_title: film.title, error: errorMessage });
      }
    }

    // Insérer/mettre à jour les programmes hebdomadaires en lot
    if (weeklyPrograms.length > 0) {
      await upsertWeeklyPrograms(db, weeklyPrograms);
      console.log(`  ✅ Weekly programs updated for ${weeklyPrograms.length} films`);
    }

    console.log(`✅ Scraped ${filmShowtimesData.length} films from ${cinema.name} for ${date}`);
    progress?.emit({ type: 'date_completed', date, films_count: filmsCount });

    return { filmsCount, showtimesCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error scraping ${cinema.name} for ${date}:`, error);
    throw new Error(errorMessage);
  }
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
}

// Run the full scraper with progress tracking
export async function addCinemaAndScrape(
  url: string,
  progress?: ProgressTracker
): Promise<Cinema> {
  // 1. Extract ID
  const cinemaId = extractCinemaIdFromUrl(url);
  if (!cinemaId) {
    throw new Error(
      'Could not extract cinema ID from URL. URL format should be like https://www.allocine.fr/seance/salle_affich-salle=C0013.html'
    );
  }

  // 2. Prepare temp config
  const tempConfig: CinemaConfig = {
    id: cinemaId,
    url,
    name: 'New Cinema', // Will be updated by loadTheaterMetadata
  };

  // 3. Load metadata (fetches page, parses it, and upserts cinema)
  console.log(`\n🆕 Adding new cinema from ${url}...`);
  const { availableDates, cinema } = await loadTheaterMetadata(db, tempConfig);

  // 4. Scrape available dates
  console.log(`   📅 Scraping ${availableDates.length} available date(s)...`);
  for (const date of availableDates) {
    try {
      await scrapeTheater(db, tempConfig, date, progress);
    } catch (error) {
      console.error(`   ❌ Failed to scrape date ${date}:`, error);
      // Continue with other dates
    }
  }

  await closeBrowser();

  // 5. Sync cinemas to JSON file after successful scrape
  const { syncCinemasFromDatabase } = await import('../cinema-config.js');
  await syncCinemasFromDatabase(db);
  console.log('✅ Cinema added and synced to JSON file');

  return cinema;
}

export async function runScraper(
  progress?: ProgressTracker,
  options?: ScrapeOptions
): Promise<ScrapeSummary> {
  console.log('🚀 Starting Allo-Scrapper...\n');

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

  try {
    // Charger la configuration des cinémas depuis la base de données
    const cinemas = await getCinemaConfigs(db);
    console.log(`📋 Loaded ${cinemas.length} cinema(s) from database\n`);

    // Déterminer les dates à scraper
    const scrapeMode = options?.mode ?? (process.env.SCRAPE_MODE as ScrapeMode) ?? 'from_today_limited';
    const scrapeDays = options?.days || parseInt(process.env.SCRAPE_DAYS || '7', 10);
    const dates = getScrapeDates(scrapeMode, scrapeDays);
    console.log(`📅 Mode: ${scrapeMode}, Scraping ${dates.length} date(s) (SCRAPE_DAYS=${scrapeDays}): ${dates.join(', ')}\n`);

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

      console.log(`\n🎬 Processing ${cinema.name} (${cinema.id})...`);

      // Step 1: Load theater page once to get metadata + available dates
      let availableDates: string[] = [];
      try {
        const meta = await loadTheaterMetadata(db, cinema);
        availableDates = meta.availableDates;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to load theater metadata for ${cinema.name}:`, errorMessage);
        summary.errors.push({ cinema_name: cinema.name, error: errorMessage });
        summary.failed_cinemas++;
        continue;
      }

      // Intersect requested dates with actually-available dates from the page
      const datesToScrape = dates.filter(d => availableDates.includes(d));
      const skippedDates = dates.filter(d => !availableDates.includes(d));

      if (skippedDates.length > 0) {
        console.log(`   ⏭️  Skipping ${skippedDates.length} date(s) not yet published: ${skippedDates.join(', ')}`);
      }
      console.log(`   📅 Scraping ${datesToScrape.length} date(s): ${datesToScrape.join(', ')}`);

      // Step 2: Fetch showtimes JSON for each available date
      for (const date of datesToScrape) {
        console.log(`\n   📅 Attempting date: ${date}`);
        try {
          const { filmsCount, showtimesCount } = await scrapeTheater(db, cinema, date, progress);
          cinemaFilmsCount += filmsCount;
          cinemaShowtimesCount += showtimesCount;
          successfulDates++;
          console.log(`   ✅ Date ${date} completed: ${filmsCount} films, ${showtimesCount} showtimes`);
          await delay(500); // Délai entre chaque requête
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`   ❌ Date ${date} failed:`, errorMessage);
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

      console.log(`\n📊 ${cinema.name} summary: ${successfulDates}/${datesToScrape.length} dates successful, ${cinemaFilmsCount} films, ${cinemaShowtimesCount} showtimes`);

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
        console.error(`❌ ${cinema.name} failed completely (0/${datesToScrape.length} dates successful)`);
      }
    }

    console.log('\n✨ Scraping completed!');
    await closeBrowser();
    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', error);
    await closeBrowser();
    summary.errors.push({ cinema_name: 'System', error: errorMessage });
    throw error;
  }
}
