// fallow-ignore-file security-sink
import type { DB } from './index.js';

export async function getActiveScrapeJobsCount(db: DB): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM pg_stat_activity
     WHERE state = 'active' AND query LIKE '%scrape%'`,
    []
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
