import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './client.js';
import type { CinemaConfig } from '../types/scraper.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function initializeDatabase() {
  logger.info('🔄 Initialisation de la base de données PostgreSQL...');

  const schema = [
    // Enable extensions
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

    // Table: cinemas
    `CREATE TABLE IF NOT EXISTS cinemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      postal_code TEXT,
      city TEXT,
      screen_count INTEGER,
      image_url TEXT,
      url TEXT
    )`,

    // Migration: add url column to existing databases
    `ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS url TEXT`,

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
      source_url TEXT NOT NULL
    )`,

    // Index for films title (trigram similarity for fuzzy search)
    `CREATE INDEX IF NOT EXISTS idx_films_title_trgm ON films USING gin(title gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_films_original_title_trgm ON films USING gin(original_title gin_trgm_ops)`,

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
      FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
    )`,

    // Indexes for showtimes
    `CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date ON showtimes(cinema_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_showtimes_film_date ON showtimes(film_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_showtimes_week ON showtimes(week_start)`,
    `CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_week ON showtimes(cinema_id, week_start)`,

    // Table: weekly_programs
    `CREATE TABLE IF NOT EXISTS weekly_programs (
      id SERIAL PRIMARY KEY,
      cinema_id TEXT NOT NULL,
      film_id INTEGER NOT NULL,
      week_start TEXT NOT NULL,
      is_new_this_week INTEGER NOT NULL DEFAULT 0,
      scraped_at TEXT NOT NULL,
      FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE,
      FOREIGN KEY (film_id) REFERENCES films(id),
      UNIQUE(cinema_id, film_id, week_start)
    )`,

    // Index for weekly_programs
    `CREATE INDEX IF NOT EXISTS idx_weekly_programs_week ON weekly_programs(week_start)`,

    // Table: scrape_reports
    `CREATE TABLE IF NOT EXISTS scrape_reports (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      status TEXT NOT NULL, -- 'running', 'success', 'partial_success', 'failed'
      trigger_type TEXT NOT NULL, -- 'manual', 'cron'
      total_cinemas INTEGER,
      successful_cinemas INTEGER,
      failed_cinemas INTEGER,
      total_films_scraped INTEGER,
      total_showtimes_scraped INTEGER,
      errors JSONB, -- Array of error objects
      progress_log JSONB -- Array of progress events
    )`,

    // Indexes for scrape_reports
    `CREATE INDEX IF NOT EXISTS idx_scrape_reports_started_at ON scrape_reports(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_scrape_reports_status ON scrape_reports(status)`,

    // Table: users (Auth system)
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,

    // Migration: add role column to users (if not exists)
    `DO $$ 
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'role'
       ) THEN
         ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
         ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
         CREATE INDEX idx_users_role ON users(role);
       END IF;
     END $$`,

    // Table: app_settings (White-label branding configuration)
    `CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      site_name TEXT NOT NULL DEFAULT 'Allo-Scrapper',
      logo_base64 TEXT,
      favicon_base64 TEXT,
      color_primary TEXT NOT NULL DEFAULT '#FECC00',
      color_secondary TEXT NOT NULL DEFAULT '#1F2937',
      color_accent TEXT NOT NULL DEFAULT '#3B82F6',
      color_background TEXT NOT NULL DEFAULT '#F9FAFB',
      color_text TEXT NOT NULL DEFAULT '#111827',
      color_link TEXT NOT NULL DEFAULT '#2563EB',
      color_success TEXT NOT NULL DEFAULT '#10B981',
      color_warning TEXT NOT NULL DEFAULT '#F59E0B',
      color_error TEXT NOT NULL DEFAULT '#EF4444',
      font_family_heading TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
      font_family_body TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
      footer_text TEXT DEFAULT 'Données fournies par le site source - Mise à jour hebdomadaire',
      footer_copyright TEXT DEFAULT '{site_name} © {year}',
      footer_links JSONB DEFAULT '[]'::jsonb,
      email_from_name TEXT DEFAULT 'Allo-Scrapper',
      email_header_color TEXT DEFAULT '#FECC00',
      email_footer_text TEXT,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id),
      CONSTRAINT singleton_check CHECK (id = 1)
    )`,

    // Insert default app_settings (singleton)
    `INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,

    // Index for app_settings
    `CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at)`
  ];

  try {
    for (const statement of schema) {
      await db.query(statement);
    }
    logger.info('✅ Base de données initialisée avec succès');
  } catch (error) {
    logger.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }

  // Seed cinemas from cinemas.json if DB is empty
  await seedCinemasIfEmpty();
}

async function seedCinemasIfEmpty(): Promise<void> {
  try {
    const countResult = await db.query('SELECT COUNT(*) as count FROM cinemas WHERE url IS NOT NULL');
    const count = parseInt(countResult.rows[0].count, 10);

    if (count > 0) {
      logger.info(`ℹ️  Cinemas already seeded (${count} with URL). Skipping seed.`);
      return;
    }

    const configPath = join(__dirname, '../config/cinemas.json');
    const content = await readFile(configPath, 'utf-8');
    const cinemas: CinemaConfig[] = JSON.parse(content);

    for (const cinema of cinemas) {
      await db.query(
        `INSERT INTO cinemas (id, name, url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [cinema.id, cinema.name, cinema.url]
      );
    }

    logger.info(`🌱 Seeded ${cinemas.length} cinema(s) from cinemas.json`);
  } catch (error) {
    logger.error('⚠️  Warning: Could not seed cinemas:', error);
    // Non-fatal: continue without seeding
  }
}

// Script d'exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().then(() => db.end());
}
