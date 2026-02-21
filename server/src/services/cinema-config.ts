import { readFile, writeFile, rename } from 'fs/promises';
import { lock } from 'proper-lockfile';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { DB } from '../db/client.js';
import type { CinemaConfig } from '../types/scraper.js';
import {
  addCinema,
  updateCinemaConfig,
  deleteCinema,
  getCinemaConfigs,
} from '../db/queries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CINEMAS_JSON_PATH = join(__dirname, '../config/cinemas.json');

/**
 * Read cinemas from cinemas.json file
 */
export async function readCinemasJson(): Promise<CinemaConfig[]> {
  const content = await readFile(CINEMAS_JSON_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write cinemas to cinemas.json file with file locking for atomic writes
 */
export async function writeCinemasJson(cinemas: CinemaConfig[]): Promise<void> {
  // Acquire lock
  const release = await lock(CINEMAS_JSON_PATH, {
    retries: {
      retries: 5,
      minTimeout: 100,
      maxTimeout: 1000,
    },
  });

  try {
    // Write to temp file first
    const tempPath = `${CINEMAS_JSON_PATH}.tmp`;
    const content = JSON.stringify(cinemas, null, 2) + '\n';
    await writeFile(tempPath, content, 'utf-8');

    // Atomic rename (overwrite original file)
    await rename(tempPath, CINEMAS_JSON_PATH);
  } finally {
    // Release lock
    await release();
  }
}

/**
 * Add cinema to database and sync to JSON file
 * Uses transaction to ensure both DB and JSON are updated or both fail
 */
export async function addCinemaWithSync(
  db: DB,
  cinema: { id: string; name: string; url: string }
): Promise<{ id: string; name: string; url: string }> {
  // Start transaction
  await db.query('BEGIN');

  try {
    // 1. Add to database
    const dbCinema = await addCinema(db, cinema);

    // 2. Get all cinemas and update JSON file
    const allCinemas = await getCinemaConfigs(db);
    await writeCinemasJson(allCinemas);

    // 3. Commit transaction
    await db.query('COMMIT');

    return dbCinema;
  } catch (error) {
    // Rollback on any error (DB or JSON write failure)
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Update cinema in database and sync to JSON file
 * Uses transaction to ensure both DB and JSON are updated or both fail
 */
export async function updateCinemaWithSync(
  db: DB,
  id: string,
  updates: { name?: string; url?: string }
): Promise<{ id: string; name: string; url: string } | undefined> {
  // Start transaction
  await db.query('BEGIN');

  try {
    // 1. Update in database
    const dbCinema = await updateCinemaConfig(db, id, updates);

    // 2. If cinema was found and updated, sync to JSON
    if (dbCinema) {
      const allCinemas = await getCinemaConfigs(db);
      await writeCinemasJson(allCinemas);
    }

    // 3. Commit transaction
    await db.query('COMMIT');

    return dbCinema;
  } catch (error) {
    // Rollback on any error (DB or JSON write failure)
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Delete cinema from database and sync to JSON file
 * Uses transaction to ensure both DB and JSON are updated or both fail
 */
export async function deleteCinemaWithSync(
  db: DB,
  id: string
): Promise<boolean> {
  // Start transaction
  await db.query('BEGIN');

  try {
    // 1. Delete from database
    const deleted = await deleteCinema(db, id);

    // 2. If cinema was found and deleted, sync to JSON
    if (deleted) {
      const allCinemas = await getCinemaConfigs(db);
      await writeCinemasJson(allCinemas);
    }

    // 3. Commit transaction
    await db.query('COMMIT');

    return deleted;
  } catch (error) {
    // Rollback on any error (DB or JSON write failure)
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Sync cinemas from database to JSON file
 * Reads all cinemas with URLs from DB and overwrites JSON file
 * Returns the number of cinemas synced
 */
export async function syncCinemasFromDatabase(db: DB): Promise<number> {
  const cinemas = await getCinemaConfigs(db);
  await writeCinemasJson(cinemas);
  return cinemas.length;
}
