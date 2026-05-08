/**
 * Monthly quota reset scheduler.
 * 
 * Runs once per day at midnight UTC and resets scrapes_count + api_calls_count
 * for all organizations on the 1st of each month.
 * 
 * Uses PostgreSQL advisory lock (pg_try_advisory_lock) to ensure only one
 * instance executes the reset in multi-instance deployments.
 */

import { QuotaService } from './services/quota-service.js';
import type { DB } from './db/types.js';
import { logger } from './utils/logger.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** PostgreSQL advisory lock key — arbitrary int64, unique to this scheduler. */
const QUOTA_RESET_LOCK_KEY = 8675309;

/**
 * Calculate milliseconds until next midnight UTC.
 */
function msUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return tomorrow.getTime() - now.getTime();
}

/**
 * Check if today is the 1st of the month.
 */
function isFirstOfMonth(): boolean {
  const now = new Date();
  return now.getUTCDate() === 1;
}

/**
 * Reset monthly usage for all organizations.
 * Runs only on the 1st of each month.
 */
async function runMonthlyReset(db: DB): Promise<void> {
  if (!isFirstOfMonth()) {
    return; // Not the 1st, skip
  }

  // Try to acquire advisory lock — if another instance holds it, skip silently
  const lockResult = await db.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock($1) AS locked`,
    [QUOTA_RESET_LOCK_KEY]
  );

  if (!lockResult.rows[0]?.locked) {
    logger.info('[quota-reset] Another instance is already running the monthly reset — skipping');
    return;
  }

  try {
    // Fetch all active organizations from public schema
    const result = await db.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM organizations WHERE status IN ('trial', 'active')`
    );

    const quotaService = new QuotaService(db);

    for (const org of result.rows) {
      try {
        await quotaService.resetMonthlyUsage(org.id);
        logger.info(`[quota-reset] Reset monthly usage for org ${org.slug} (id=${org.id})`);
      } catch (error) {
        logger.error(`[quota-reset] Failed to reset org ${org.slug}:`, error);
      }
    }

    logger.info(`[quota-reset] Monthly reset completed for ${result.rows.length} organizations`);
  } catch (error) {
    logger.error('[quota-reset] Monthly reset failed:', error);
  } finally {
    // Always release the lock
    await db.query(`SELECT pg_advisory_unlock($1)`, [QUOTA_RESET_LOCK_KEY]).catch(() => {});
  }
}

/**
 * Start the monthly quota reset scheduler.
 * Runs daily at midnight UTC and resets usage on the 1st of each month.
 */
export function startQuotaResetScheduler(db: DB): NodeJS.Timeout {
  // Run immediately if today is the 1st
  runMonthlyReset(db);

  // Schedule first run at midnight UTC
  const initialDelayMs = msUntilMidnightUTC();
  logger.info(
    `[quota-reset] Scheduler started. First check in ${Math.round(initialDelayMs / 1000 / 60)} minutes`
  );

  const timer = setTimeout(() => {
    runMonthlyReset(db);

    // Then run daily at midnight UTC
    setInterval(() => {
      runMonthlyReset(db);
    }, ONE_DAY_MS);
  }, initialDelayMs);

  return timer;
}
