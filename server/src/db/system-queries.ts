import type { DB } from './client.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Applied migration record
 */
export interface AppliedMigration {
  version: string;
  appliedAt: Date;
  status: 'applied';
}

/**
 * Pending migration record
 */
export interface PendingMigration {
  version: string;
  status: 'pending';
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  size: string;
  tables: number;
  cinemas: number;
  films: number;
  showtimes: number;
}

/**
 * Get migrations directory path (works in both dev and Docker)
 */
function getMigrationsDir(): string {
  const isDocker = __dirname.startsWith('/app/dist');
  return isDocker
    ? path.join('/app', 'migrations')
    : path.join(__dirname, '../../../migrations');
}

/**
 * Get list of applied migrations from schema_migrations table
 * 
 * @param db - Database client
 * @returns Array of applied migrations with timestamps
 */
export async function getAppliedMigrations(db: DB): Promise<AppliedMigration[]> {
  const result = await db.query(
    `SELECT version, applied_at
     FROM schema_migrations
     ORDER BY version ASC`,
    []
  );

  return result.rows.map(row => ({
    version: row.version,
    appliedAt: row.applied_at,
    status: 'applied' as const,
  }));
}

/**
 * Get list of pending migrations that haven't been applied yet
 * Compares migration files in migrations/ directory with schema_migrations table
 * 
 * @param db - Database client
 * @returns Array of pending migrations
 */
export async function getPendingMigrations(db: DB): Promise<PendingMigration[]> {
  // Get applied migrations from database
  const appliedResult = await db.query(
    `SELECT version FROM schema_migrations`,
    []
  );
  const appliedVersions = new Set(appliedResult.rows.map(row => row.version));

  // Get all migration files from migrations directory
  const migrationsDir = getMigrationsDir();
  const allFiles = await fs.readdir(migrationsDir);
  const migrationFiles = allFiles
    .filter(f => f.endsWith('.sql') && f.match(/^\d+_/))
    .sort();

  // Find pending migrations
  const pending: PendingMigration[] = migrationFiles
    .filter(file => !appliedVersions.has(file))
    .map(file => ({
      version: file,
      status: 'pending' as const,
    }));

  return pending;
}

/**
 * Get database statistics including size and record counts
 * 
 * @param db - Database client
 * @returns Database statistics
 */
export async function getDatabaseStats(db: DB): Promise<DatabaseStats> {
  // Get database size
  const sizeResult = await db.query(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    []
  );
  const size = sizeResult.rows[0]?.size || '0 bytes';

  // Get table count
  const tableCountResult = await db.query(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'`,
    []
  );
  const tables = parseInt(tableCountResult.rows[0]?.count || '0', 10);

  // Get cinema count
  const cinemaCountResult = await db.query(
    `SELECT COUNT(*)::text AS count FROM cinemas`,
    []
  );
  const cinemas = parseInt(cinemaCountResult.rows[0]?.count || '0', 10);

  // Get film count
  const filmCountResult = await db.query(
    `SELECT COUNT(*)::text AS count FROM films`,
    []
  );
  const films = parseInt(filmCountResult.rows[0]?.count || '0', 10);

  // Get showtime count
  const showtimeCountResult = await db.query(
    `SELECT COUNT(*)::text AS count FROM showtimes`,
    []
  );
  const showtimes = parseInt(showtimeCountResult.rows[0]?.count || '0', 10);

  return {
    size,
    tables,
    cinemas,
    films,
    showtimes,
  };
}
