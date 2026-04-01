import type { DB } from '../db/types.js';

export type QuotaResource = 'cinemas' | 'users' | 'scrapes';

export interface OrgUsage {
  id: number;
  org_id: string;
  month: string;
  cinemas_count: number;
  users_count: number;
  scrapes_count: number;
  api_calls_count: number;
}

/** Returns the first day of the current month as a DATE string (YYYY-MM-01). */
function currentMonthDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

const COLUMN_MAP: Record<QuotaResource, string> = {
  cinemas: 'cinemas_count',
  users:   'users_count',
  scrapes: 'scrapes_count',
};

export class QuotaService {
  constructor(private db: DB) {}

  /**
   * Returns the usage row for the current month, creating it (all zeros) if absent.
   */
  async getOrCreateUsage(orgId: string): Promise<OrgUsage> {
    const month = currentMonthDate();

    const existing = await this.db.query<OrgUsage>(
      `SELECT * FROM org_usage WHERE org_id = $1 AND month = $2`,
      [orgId, month],
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const inserted = await this.db.query<OrgUsage>(
      `INSERT INTO org_usage (org_id, month)
       VALUES ($1, $2)
       RETURNING *`,
      [orgId, month],
    );
    return inserted.rows[0];
  }

  /**
   * Atomically increments the named resource counter for the current month.
   * Uses UPSERT so the row is created on first increment if missing.
   */
  async incrementUsage(orgId: string, resource: QuotaResource): Promise<void> {
    const col = COLUMN_MAP[resource];
    const month = currentMonthDate();

    await this.db.query(
      `INSERT INTO org_usage (org_id, month, ${col})
       VALUES ($1, $2, 1)
       ON CONFLICT (org_id, month) DO UPDATE
         SET ${col} = org_usage.${col} + 1`,
      [orgId, month],
    );
  }

  /**
   * Atomically decrements the named resource counter, floored at 0.
   */
  async decrementUsage(orgId: string, resource: QuotaResource): Promise<void> {
    const col = COLUMN_MAP[resource];
    const month = currentMonthDate();

    await this.db.query(
      `UPDATE org_usage
          SET ${col} = GREATEST(0, ${col} - 1)
        WHERE org_id = $1 AND month = $2`,
      [orgId, month],
    );
  }

  /**
   * Resets scrapes_count and api_calls_count to 0 for the current month.
   * Called on the 1st of each month (cron job).
   */
  async resetMonthlyUsage(orgId: string): Promise<void> {
    const month = currentMonthDate();

    await this.db.query(
      `UPDATE org_usage
          SET scrapes_count   = 0,
              api_calls_count = 0
        WHERE org_id = $1 AND month = $2`,
      [orgId, month],
    );
  }
}
