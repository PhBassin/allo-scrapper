/**
 * Monthly quota reset scheduler.
 * 
 * Runs once per day at midnight UTC and resets scrapes_count + api_calls_count
 * for all organizations on the 1st of each month.
 * 
 * This is a simple in-process scheduler. For production multi-instance deployments,
 * consider using a distributed cron solution (e.g., pg_cron, BullMQ, or external service).
 */

import { QuotaService } from './services/quota-service.js';
import type { DB } from './db/types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

  try {
    // Fetch all active organizations from public schema
    const result = await db.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM organizations WHERE status IN ('trial', 'active')`
    );

    const quotaService = new QuotaService(db);

    for (const org of result.rows) {
      try {
        await quotaService.resetMonthlyUsage(org.id);
        console.log(`[quota-reset] Reset monthly usage for org ${org.slug} (id=${org.id})`);
      } catch (error) {
        console.error(`[quota-reset] Failed to reset org ${org.slug}:`, error);
      }
    }

    console.log(`[quota-reset] Monthly reset completed for ${result.rows.length} organizations`);
  } catch (error) {
    console.error('[quota-reset] Monthly reset failed:', error);
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
  console.log(
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
