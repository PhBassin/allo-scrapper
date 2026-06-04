import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './client.js';
import type { TheaterConfig } from '../types/scraper.js';
import { logger } from '../utils/logger.js';
import { runMigrations } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize database by running automatic migrations
 * Uses the migration runner to apply all pending SQL migrations from migrations/ directory
 * 
 * Respects AUTO_MIGRATE environment variable (default: true)
 * If AUTO_MIGRATE=false, migrations must be applied manually
 */
export async function initializeDatabase() {
  logger.info('🔄 Initializing PostgreSQL database...');

  const autoMigrate = process.env.AUTO_MIGRATE !== 'false';

  if (autoMigrate) {
    logger.info('Auto-migration enabled, applying pending migrations...');
    try {
      await runMigrations(db);
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

  // Seed theaters from theaters.json if DB is empty
  await seedTheatersIfEmpty();
}

async function seedTheatersIfEmpty(): Promise<void> {
  try {
    const countResult = await db.query('SELECT COUNT(*) as count FROM theaters WHERE url IS NOT NULL');
    const count = parseInt(countResult.rows[0].count, 10);

    if (count > 0) {
      logger.info(`ℹ️  Theaters already seeded (${count} with URL). Skipping seed.`);
      return;
    }

    const configPath = join(__dirname, '../config/theaters.json');
    const content = await readFile(configPath, 'utf-8');
    const theaters: TheaterConfig[] = JSON.parse(content);

    for (const theater of theaters) {
      await db.query(
        `INSERT INTO theaters (id, name, url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [theater.id, theater.name, theater.url]
      );
    }

    logger.info(`🌱 Seeded ${theaters.length} theater(s) from theaters.json`);
  } catch (error) {
    // Log only the error message to prevent sensitive data exposure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('⚠️  Warning: Could not seed theaters:', errorMessage);
    // Non-fatal: continue without seeding
  }
}

// Script d'exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().then(() => db.end());
}
