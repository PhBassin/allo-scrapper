import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db, type DB } from '../../db/client.js';
import {
  upsertCinema,
  upsertFilm,
  upsertShowtime,
  upsertWeeklyProgram,
  getFilm,
} from '../../db/queries.js';
import { fetchTheaterPage, fetchFilmPage, delay } from './http-client.js';
import { parseTheaterPage } from './theater-parser.js';
import { parseFilmPage } from './film-parser.js';
import type { CinemaConfig } from '../../types/scraper.js';
import { getScrapeDates, type ScrapeMode } from '../../utils/date.js';
import type { ProgressTracker, ScrapeSummary } from '../progress-tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger la configuration des cinémas
async function loadCinemaConfig(): Promise<CinemaConfig[]> {
  const configPath = join(__dirname, '../../config/cinemas.json');
  const content = await readFile(configPath, 'utf-8');
  return JSON.parse(content);
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
    // Récupérer la page HTML
    const html = await fetchTheaterPage(cinema.id, date);

    // Parser la page
    const pageData = parseTheaterPage(html, cinema.id);

    // Insérer/mettre à jour le cinéma
    await upsertCinema(db, pageData.cinema);
    console.log(`✅ Cinema ${pageData.cinema.name} updated`);

    // Traiter chaque film
    for (const filmData of pageData.films) {
      const film = filmData.film;

      progress?.emit({ type: 'film_started', film_title: film.title, film_id: film.id });

      try {
        // Vérifier si le film existe déjà et a une durée
        const existingFilm = await getFilm(db, film.id);

        // Si le film n'a pas de durée ou n'existe pas, scraper la fiche film
        if (!existingFilm || !existingFilm.duration_minutes) {
          console.log(`  🎬 Fetching film details for "${film.title}" (${film.id})...`);

          try {
            const filmHtml = await fetchFilmPage(film.id);
            const filmPageData = parseFilmPage(filmHtml);

            // Mettre à jour les données du film avec la durée
            if (filmPageData.duration_minutes) {
              film.duration_minutes = filmPageData.duration_minutes;
            }

            await delay(500); // Délai pour éviter le rate limiting
          } catch (error) {
            console.error(`  ⚠️  Error fetching film page for ${film.id}:`, error);
          }
        } else {
          // Utiliser la durée existante
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

        // Insérer/mettre à jour le programme hebdomadaire
        await upsertWeeklyProgram(db, {
          cinema_id: cinema.id,
          film_id: film.id,
          week_start: filmData.showtimes[0]?.week_start || date,
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

    console.log(`✅ Scraped ${pageData.films.length} films from ${cinema.name}`);
    progress?.emit({ type: 'date_completed', date, films_count: filmsCount });

    return { filmsCount, showtimesCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error scraping ${cinema.name}:`, error);
    throw new Error(errorMessage);
  }
}

export interface ScrapeOptions {
  mode?: ScrapeMode;
  days?: number;
}

// Run the full scraper with progress tracking
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
    // Charger la configuration des cinémas
    const cinemas = await loadCinemaConfig();
    console.log(`📋 Loaded ${cinemas.length} cinema(s) from config\n`);

    // Déterminer les dates à scraper
    const scrapeMode = options?.mode || (process.env.SCRAPE_MODE as ScrapeMode) || 'weekly';
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
      console.log(`   Target: ${dates.length} dates (${dates[0]} to ${dates[dates.length - 1]})`);

      for (const date of dates) {
        console.log(`\n   📅 Attempting date: ${date}`);
        try {
          const { filmsCount, showtimesCount } = await scrapeTheater(db, cinema, date, progress);
          cinemaFilmsCount += filmsCount;
          cinemaShowtimesCount += showtimesCount;
          successfulDates++;
          console.log(`   ✅ Date ${date} completed: ${filmsCount} films, ${showtimesCount} showtimes`);
          await delay(1000); // Délai entre chaque requête
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

      const cinemaFailed = successfulDates === 0;

      console.log(`\n📊 ${cinema.name} summary: ${successfulDates}/${dates.length} dates successful, ${cinemaFilmsCount} films, ${cinemaShowtimesCount} showtimes`);

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
        console.error(`❌ ${cinema.name} failed completely (0/${dates.length} dates successful)`);
      }
    }

    console.log('\n✨ Scraping completed!');
    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', error);
    summary.errors.push({ cinema_name: 'System', error: errorMessage });
    throw error;
  }
}
