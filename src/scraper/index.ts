#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db, type DB } from '../db/client.js';
import { initializeDatabase } from '../db/schema.js';
import {
  upsertCinema,
  upsertFilm,
  upsertShowtime,
  upsertWeeklyProgram,
  getFilm,
} from '../db/queries.js';
import { fetchTheaterPage, fetchFilmPage, delay } from './allocine-client.js';
import { parseTheaterPage } from './theater-parser.js';
import { parseFilmPage } from './film-parser.js';
import type { CinemaConfig } from './types.js';
import { getWeekDates } from '../utils/date.js';

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
  date: string
): Promise<void> {
  console.log(`\n📍 Scraping ${cinema.name} (${cinema.id}) for ${date}...`);

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
    }

    console.log(`✅ Scraped ${pageData.films.length} films from ${cinema.name}`);
  } catch (error) {
    console.error(`❌ Error scraping ${cinema.name}:`, error);
  }
}

// Script principal
async function main() {
  console.log('🚀 Starting Allo-Scrapper...\n');

  // Initialiser la base de données
  await initializeDatabase();
  
  // Charger la configuration des cinémas
  const cinemas = await loadCinemaConfig();
  console.log(`📋 Loaded ${cinemas.length} cinema(s) from config\n`);

  // Déterminer les dates à scraper
  const dates = getWeekDates();
  console.log(
    `📅 Scraping ${dates.length} date(s): ${dates.join(', ')}\n`
  );

  // Scraper chaque cinéma pour chaque date
  for (const cinema of cinemas) {
    for (const date of dates) {
      await scrapeTheater(db, cinema, date);
      await delay(1000); // Délai entre chaque requête
    }
  }

  // db.close() n'existe pas sur @libsql/client, la connexion est gérée automatiquement ou via close() si nécessaire, mais ce n'est pas typique pour les scripts one-off comme ici
  console.log('\n✨ Scraping completed!');
}

// Exécuter le script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
