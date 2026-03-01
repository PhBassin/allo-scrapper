import { type DB } from './client.js';
import { logger } from '../utils/logger.js';
import { generateRandomPassword } from './user-queries.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration record in schema_migrations table
 */
export interface Migration {
  version: string;
  checksum: string;
  applied_at: Date;
}

/**
 * Calculate SHA-256 checksum for migration file content
 * Used to detect if migration files have been modified after application
 * 
 * @param sql - SQL content to hash
 * @returns SHA-256 hash as hex string (64 characters)
 */
export function calculateChecksum(sql: string): string {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

/**
 * Create schema_migrations table if it doesn't exist
 * This table tracks which migrations have been applied and their checksums
 * 
 * @param db - Database client
 */
export async function createSchemaTable(db: DB): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
    ON schema_migrations(applied_at)
  `);

  logger.debug('Schema migrations table verified');
}

/**
 * Read migration SQL file from migrations/ directory
 * 
 * @param filename - Migration filename (e.g., '001_initial.sql')
 * @returns SQL content as string
 */
/**
 * Get the migrations directory path (works in both development and Docker)
 * In Docker: /app/migrations (copied by Dockerfile)
 * In development: /path/to/project/migrations
 */
function getMigrationsDir(): string {
  return process.env.NODE_ENV === 'production'
    ? path.join('/app', 'migrations')
    : path.join(__dirname, '../../../migrations');
}

/**
 * Read a migration file from the migrations directory
 * 
 * @param filename - Migration filename (e.g., "001_initial_schema.sql")
 * @returns SQL content of the migration file
 */
async function readMigrationFile(filename: string): Promise<string> {
  const migrationsDir = getMigrationsDir();
  const filePath = path.join(migrationsDir, filename);
  return await fs.readFile(filePath, 'utf8');
}

/**
 * Get list of pending migrations that haven't been applied yet
 * Compares migration files in migrations/ directory with schema_migrations table
 * 
 * @param db - Database client
 * @returns Array of migration filenames to apply
 */
export async function getPendingMigrations(db: DB): Promise<string[]> {
  // Get all migration files
  const migrationsDir = getMigrationsDir();
  const allFiles = await fs.readdir(migrationsDir);
  const migrationFiles = allFiles
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sort by filename (001, 002, etc.)

  // Get applied migrations
  const result = await db.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(result.rows.map(r => r.version));

  // Check for applied migrations with missing files
  for (const applied of appliedVersions) {
    if (!migrationFiles.includes(applied)) {
      logger.warn(
        `Migration ${applied} was applied but file not found in migrations/ directory`
      );
    }
  }

  // Return only unapplied migrations
  const pending = migrationFiles.filter(f => !appliedVersions.has(f));
  return pending;
}

/**
 * Apply a single migration and record it in schema_migrations table
 * 
 * @param db - Database client
 * @param filename - Migration filename to apply
 */
export async function applyMigration(db: DB, filename: string): Promise<void> {
  logger.info(`Applying migration ${filename}...`);

  // Read and execute migration SQL
  const sql = await readMigrationFile(filename);
  await db.query(sql);

  // Calculate and store checksum
  const checksum = calculateChecksum(sql);
  await db.query(
    'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
    [filename, checksum]
  );

  // Special handling for admin seed migration
  if (filename === '007_seed_default_admin.sql') {
    await handleAdminSeed(db);
  }

  logger.info(`Migration ${filename} completed successfully`);
}

/**
 * Verify checksums of already-applied migrations
 * Warns if migration files have been modified after application
 * 
 * @param db - Database client
 * @param migrationFiles - All migration files in migrations/ directory
 */
async function verifyChecksums(db: DB, migrationFiles: string[]): Promise<void> {
  const result = await db.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM schema_migrations'
  );

  for (const row of result.rows) {
    if (!migrationFiles.includes(row.version)) {
      continue; // Skip if file no longer exists (already warned)
    }

    const sql = await readMigrationFile(row.version);
    const currentChecksum = calculateChecksum(sql);

    if (currentChecksum !== row.checksum) {
      logger.warn(
        `Migration ${row.version} checksum mismatch (file modified after application)`
      );
      logger.warn(
        `  Applied checksum: ${row.checksum}`
      );
      logger.warn(
        `  Current checksum: ${currentChecksum}`
      );
    }
  }
}

/**
 * Run all pending migrations in order
 * Main entry point for automatic migration system
 * 
 * @param db - Database client
 */
export async function runMigrations(db: DB): Promise<void> {
  logger.info('Checking for pending database migrations...');

  // Ensure schema_migrations table exists
  await createSchemaTable(db);

  // Get all migration files for checksum verification
  const migrationsDir = path.join(__dirname, '../../../migrations');
  const allFiles = await fs.readdir(migrationsDir);
  const migrationFiles = allFiles.filter(f => f.endsWith('.sql')).sort();

  // Verify checksums of already-applied migrations
  await verifyChecksums(db, migrationFiles);

  // Get pending migrations
  const pending = await getPendingMigrations(db);

  if (pending.length === 0) {
    logger.info('All migrations up to date');
    return;
  }

  logger.info(`Found ${pending.length} pending migration(s)`);

  // Apply each pending migration
  for (const filename of pending) {
    await applyMigration(db, filename);
  }

  logger.info('All pending migrations applied successfully');
}

/**
 * Handle admin user seeding for migration 007
 * Creates default admin user with random password if no admin exists
 * Logs password prominently for first-time setup
 * 
 * Option C-Enhanced:
 * - If no admins exist and 'admin' username exists with wrong role: fix role
 * - If no admins exist and 'admin' username doesn't exist: create new admin
 * - If any admin exists: skip
 * 
 * @param db - Database client
 */
async function handleAdminSeed(db: DB): Promise<void> {
  // Check if any admin exists
  const adminCountResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
  );
  const adminCount = parseInt(adminCountResult.rows[0].count);

  if (adminCount > 0) {
    logger.info(`Admin user already exists (count: ${adminCount}), skipping seed`);
    return;
  }

  // Check if 'admin' username exists with wrong role (broken migration scenario)
  const existingAdminResult = await db.query<{ id: number; role: string }>(
    `SELECT id, role FROM users WHERE username = 'admin'`
  );

  if (existingAdminResult.rows.length > 0) {
    const { id, role } = existingAdminResult.rows[0];
    logger.warn(`User 'admin' exists with role '${role}' instead of 'admin'`);

    // Fix role
    await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [id]);
    logger.warn(`Fixed admin user role (id: ${id})`);
    logger.warn('⚠️  SECURITY: Admin password unchanged - reset via UI or API');
    return;
  }

  // Create new admin user with random password
  const password = generateRandomPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await db.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
    ['admin', passwordHash, 'admin']
  );

  // Log password prominently
  logger.warn('═══════════════════════════════════════════════════════════');
  logger.warn('🔐 DEFAULT ADMIN USER CREATED');
  logger.warn('═══════════════════════════════════════════════════════════');
  logger.warn('Username: admin');
  logger.warn(`Password: ${password}`);
  logger.warn('═══════════════════════════════════════════════════════════');
  logger.warn('⚠️  SECURITY WARNING:');
  logger.warn('1. Save this password immediately');
  logger.warn('2. Change it after first login');
  logger.warn('3. This password will NOT be shown again');
  logger.warn('═══════════════════════════════════════════════════════════');
}
