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
      logger.error('❌ Database migration failed:', error);
      throw error;
    }
  } else {
    logger.warn('⚠️  Auto-migration disabled (AUTO_MIGRATE=false)');
    logger.warn('⚠️  Ensure migrations are applied manually before starting server');
    logger.warn('⚠️  Run: docker compose exec -T ics-db psql -U postgres -d ics < migrations/XXX_*.sql');
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
