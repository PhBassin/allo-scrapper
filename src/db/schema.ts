import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/allo-scrapper.db');

export function getDatabase(): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function initializeDatabase() {
  const db = getDatabase();

  // Table: cinemas
  db.exec(`
    CREATE TABLE IF NOT EXISTS cinemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      postal_code TEXT,
      city TEXT,
      screen_count INTEGER,
      image_url TEXT
    )
  `);

  // Table: films
  db.exec(`
    CREATE TABLE IF NOT EXISTS films (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      original_title TEXT,
      poster_url TEXT,
      duration_minutes INTEGER,
      release_date TEXT,
      rerelease_date TEXT,
      genres TEXT, -- JSON array
      nationality TEXT,
      director TEXT,
      actors TEXT, -- JSON array
      synopsis TEXT,
      certificate TEXT,
      press_rating REAL,
      audience_rating REAL,
      allocine_url TEXT NOT NULL
    )
  `);

  // Table: showtimes
  db.exec(`
    CREATE TABLE IF NOT EXISTS showtimes (
      id TEXT PRIMARY KEY,
      film_id INTEGER NOT NULL,
      cinema_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      datetime_iso TEXT NOT NULL,
      version TEXT,
      format TEXT,
      experiences TEXT, -- JSON array
      week_start TEXT NOT NULL,
      FOREIGN KEY (film_id) REFERENCES films(id),
      FOREIGN KEY (cinema_id) REFERENCES cinemas(id)
    )
  `);

  // Index pour améliorer les performances
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date 
    ON showtimes(cinema_id, date)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_showtimes_film_date 
    ON showtimes(film_id, date)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_showtimes_week 
    ON showtimes(week_start)
  `);

  // Table: weekly_programs
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cinema_id TEXT NOT NULL,
      film_id INTEGER NOT NULL,
      week_start TEXT NOT NULL,
      is_new_this_week INTEGER NOT NULL DEFAULT 0,
      scraped_at TEXT NOT NULL,
      FOREIGN KEY (cinema_id) REFERENCES cinemas(id),
      FOREIGN KEY (film_id) REFERENCES films(id),
      UNIQUE(cinema_id, film_id, week_start)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_weekly_programs_week 
    ON weekly_programs(week_start)
  `);

  db.close();
  console.log('✅ Base de données initialisée avec succès');
}

// Script d'exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}
