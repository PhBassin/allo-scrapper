import { db } from './client.js';

export async function initializeDatabase() {
  console.log('🔄 Initialisation de la base de données PostgreSQL...');

  const schema = [
    // Table: cinemas
    `CREATE TABLE IF NOT EXISTS cinemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      postal_code TEXT,
      city TEXT,
      screen_count INTEGER,
      image_url TEXT
    )`,

    // Table: films
    `CREATE TABLE IF NOT EXISTS films (
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
    )`,

    // Table: showtimes
    `CREATE TABLE IF NOT EXISTS showtimes (
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
    )`,

    // Indexes for showtimes
    `CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date ON showtimes(cinema_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_showtimes_film_date ON showtimes(film_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_showtimes_week ON showtimes(week_start)`,

    // Table: weekly_programs
    // Note: AUTOINCREMENT is replaced by SERIAL in Postgres
    `CREATE TABLE IF NOT EXISTS weekly_programs (
      id SERIAL PRIMARY KEY,
      cinema_id TEXT NOT NULL,
      film_id INTEGER NOT NULL,
      week_start TEXT NOT NULL,
      is_new_this_week INTEGER NOT NULL DEFAULT 0,
      scraped_at TEXT NOT NULL,
      FOREIGN KEY (cinema_id) REFERENCES cinemas(id),
      FOREIGN KEY (film_id) REFERENCES films(id),
      UNIQUE(cinema_id, film_id, week_start)
    )`,

    // Index for weekly_programs
    `CREATE INDEX IF NOT EXISTS idx_weekly_programs_week ON weekly_programs(week_start)`
  ];

  try {
    for (const statement of schema) {
      await db.query(statement);
    }
    console.log('✅ Base de données initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  } finally {
      // In a real application, we might keep the pool open, but for initialization scripts
      // intended to run once, closing it is sometimes desired. However, if this is imported
      // by the app, we shouldn't close it here.
      // We'll leave it open as db is a shared pool.
  }
}

// Script d'exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().then(() => db.end());
}
