import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './client.js';
import type { CinemaConfig } from '../types/scraper.js';
import { logger } from '../utils/logger.js';
import { runMigrations } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize database by running automatic migrations.
 * Uses the migration runner to apply all pending SQL migrations from
 * migrations/ directory, plus any extra directories supplied by plugins.
 *
 * Respects AUTO_MIGRATE environment variable (default: true).
 * If AUTO_MIGRATE=false, migrations must be applied manually.
 *
 * @param extraMigrationDirs - Optional extra directories from plugins (e.g. SaaS)
 */
export async function initializeDatabase(extraMigrationDirs: string[] = []) {
  logger.info('🔄 Initializing PostgreSQL database...');

  const autoMigrate = process.env.AUTO_MIGRATE !== 'false';

  if (autoMigrate) {
    logger.info('Auto-migration enabled, applying pending migrations...');
    try {
      await runMigrations(db, extraMigrationDirs);
      logger.info('✅ Database initialization complete');
    } catch (error) {
      // Log only the error message to prevent sensitive data exposure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Database migration failed:', errorMessage);
      throw error;
    }
  } else {
    logger.warn('⚠️  Auto-migration disabled (AUTO_MIGRATE=false)');
    logger.warn('⚠️  Ensure migrations are applied manually before starting server');
    logger.warn('⚠️  Run: docker compose exec -T ics-db psql -U postgres -d ics < migrations/XXX_*.sql');
  }

  // Seed cinemas from cinemas.json if DB is empty
  await seedCinemasIfEmpty();

  // Seed app_settings row if missing (defense-in-depth against silent migration failures)
  await seedSettingsIfEmpty();
}

/**
 * Ensures the required app_settings singleton row (id=1) exists.
 * Idempotent — safe to call on every startup.
 *
 * Background: Migration 004 creates the table and inserts the default row with
 * ON CONFLICT DO NOTHING, but the INSERT can fail silently in edge cases
 * (transaction rollbacks, race conditions during multi-migration runs).
 * This startup guard detects and repairs the missing row.
 */
export async function seedSettingsIfEmpty(): Promise<void> {
  try {
    const result = await db.query('SELECT id FROM app_settings WHERE id = 1');
    if (result.rows.length > 0) {
      logger.info('ℹ️  app_settings row exists. Skipping seed.');
      return;
    }

    await db.query(`
      INSERT INTO app_settings (id)
      VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);

    logger.info('🌱 Seeded missing app_settings row (id=1)');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('⚠️  Warning: Could not seed app_settings:', errorMessage);
    // Non-fatal: server can still start (frontend has fallback defaults)
  }
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
    // Log only the error message to prevent sensitive data exposure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('⚠️  Warning: Could not seed cinemas:', errorMessage);
    // Non-fatal: continue without seeding
  }
}

// Script d'exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().then(() => db.end());
}
