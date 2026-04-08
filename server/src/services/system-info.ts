import type { DB } from '../db/client.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Application metadata
 */
export interface AppInfo {
  version: string;
  buildDate: string;
  environment: string;
  nodeVersion: string;
}

/**
 * Server health metrics
 */
export interface ServerHealth {
  uptime: number;
  memoryUsage: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
  };
  platform: string;
  arch: string;
}

/**
 * Scraper status information
 */
export interface ScraperStatus {
  activeJobs: number;
  lastScrapeTime: Date | null;
  totalCinemas: number;
}

/**
 * Format bytes to MB with 2 decimal places
 * 
 * @param bytes - Bytes value
 * @returns Formatted string (e.g., "45.23 MB")
 */
function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Get application metadata from package.json
 * 
 * @returns Application information
 */
export function getAppInfo(): AppInfo {
  let version = '1.0.0';
  let buildDate = new Date().toISOString();

  try {
    // Try to read package.json
    const packagePath = path.join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    version = packageJson.version || '1.0.0';
  } catch (error) {
    // If package.json not found (e.g., in Docker), use defaults
  }

  return {
    version,
    buildDate,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  };
}

/**
 * Get server health metrics
 * 
 * @returns Server health information
 */
export function getServerHealth(): ServerHealth {
  const memUsage = process.memoryUsage();

  return {
    uptime: process.uptime(),
    memoryUsage: {
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      rss: formatBytes(memUsage.rss),
    },
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Get scraper status from database
 * 
 * @param db - Database client
 * @returns Scraper status information
 */
export async function getScraperStatus(db: DB): Promise<ScraperStatus> {
  // ⚡ PERFORMANCE: Execute independent database queries concurrently
  // to reduce total response time.
  const [
    activeJobsResult,
    lastScrapeResult,
    cinemasResult
  ] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::text AS count FROM pg_stat_activity
       WHERE state = 'active' AND query LIKE '%scrape%'`,
      []
    ),
    db.query(
      `SELECT MAX(completed_at) AS last_scrape FROM scrape_reports WHERE status = 'completed'`,
      []
    ),
    db.query(
      `SELECT COUNT(*)::text AS count FROM cinemas`,
      []
    )
  ]);

  const activeJobs = parseInt(activeJobsResult.rows[0]?.count || '0', 10);
  const lastScrapeTime = lastScrapeResult.rows[0]?.last_scrape || null;
  const totalCinemas = parseInt(cinemasResult.rows[0]?.count || '0', 10);

  return {
    activeJobs,
    lastScrapeTime,
    totalCinemas,
  };
}
