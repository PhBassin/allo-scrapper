#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDatabase, initializeDatabase } from '../db/schema.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger la configuration des cinémas
async function loadCinemaConfig(): Promise<CinemaConfig[]> {
  const configPath = join(__dirname, '../../config/cinemas.json');
  const content = await readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

// Obtenir la date d'aujourd'hui au format YYYY-MM-DD
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Obtenir toutes les dates de la semaine (mercredi → mardi)
function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = dimanche, 3 = mercredi
  
  // Calculer le décalage vers le mercredi précédent ou actuel
  let offset = dayOfWeek - 3;
  if (offset < 0) {
    offset += 7;
  }
  
  const wednesday = new Date(today);
  wednesday.setDate(today.getDate() - offset);
  
  // Générer les 7 jours de la semaine (mercredi → mardi)
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(wednesday);
    date.setDate(wednesday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

// Scraper un cinéma pour une date donnée
async function scrapeTheater(
  db: ReturnType<typeof getDatabase>,
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
    upsertCinema(db, pageData.cinema);
    console.log(`✅ Cinema ${pageData.cinema.name} updated`);

    // Traiter chaque film
    for (const filmData of pageData.films) {
      const film = filmData.film;
      
      // Vérifier si le film existe déjà et a une durée
      const existingFilm = getFilm(db, film.id);
      
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
      upsertFilm(db, film);
      console.log(`  ✅ Film "${film.title}" updated`);

      // Insérer/mettre à jour les séances
      for (const showtime of filmData.showtimes) {
        upsertShowtime(db, showtime);
      }
      console.log(`  ✅ ${filmData.showtimes.length} showtimes updated`);

      // Insérer/mettre à jour le programme hebdomadaire
      upsertWeeklyProgram(db, {
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
  const args = process.argv.slice(2);
  const isWeekMode = args.includes('--week');

  console.log('🚀 Starting Allo-Scrapper...\n');

  // Initialiser la base de données
  initializeDatabase();
  const db = getDatabase();

  // Charger la configuration des cinémas
  const cinemas = await loadCinemaConfig();
  console.log(`📋 Loaded ${cinemas.length} cinema(s) from config\n`);

  // Déterminer les dates à scraper
  const dates = isWeekMode ? getWeekDates() : [getTodayDate()];
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

  db.close();
  console.log('\n✨ Scraping completed!');
}

// Exécuter le script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
