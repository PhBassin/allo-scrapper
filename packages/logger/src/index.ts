import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

export type ScrapeTraceContext = Record<string, string>;

export interface BaseScrapeJob {
  reportId: number;
  retryCount?: number;
  traceContext?: ScrapeTraceContext;
}

export interface ScrapeJobScrape extends BaseScrapeJob {
  type: 'scrape';
  triggerType: 'manual' | 'cron';
  options?: {
    mode?: 'weekly' | 'from_today' | 'from_today_limited';
    days?: number;
    cinemaId?: string;
    filmId?: number;
    resumeMode?: boolean;
    pendingAttempts?: Array<{ cinema_id: string; date: string }>;
  };
}

export interface ScrapeJobAddCinema extends BaseScrapeJob {
  type: 'add_cinema';
  triggerType: 'manual';
  url: string;
}

export type ScrapeJob = ScrapeJobScrape | ScrapeJobAddCinema;

export interface ScheduleChangeEvent {
  action: 'created' | 'updated' | 'deleted';
  scheduleId: number;
  schedule?: {
    id: number;
    name: string;
    cron_expression: string;
    enabled: boolean;
    target_cinemas?: string[] | null;
  };
}

export interface DlqJobEntry {
  job_id: string;
  failure_reason: string;
  retry_count: number;
  timestamp: string;
  cinema_id?: string;
  org_id?: string;
  org_slug?: string;
  user_id?: string;
  endpoint?: string;
  job: ScrapeJob;
}

export const SCRAPE_JOBS_KEY = 'scrape:jobs';
export const SCRAPE_DLQ_KEY = 'scrape:jobs:dlq';
export const MAX_SCRAPE_JOB_RETRY_ATTEMPTS = 3;
export const SCRAPE_JOB_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

export function getScrapeJobRetryDelayMs(retryAttempt: number): number {
  if (retryAttempt <= 1) return SCRAPE_JOB_RETRY_DELAYS_MS[0];
  if (retryAttempt === 2) return SCRAPE_JOB_RETRY_DELAYS_MS[1];
  return SCRAPE_JOB_RETRY_DELAYS_MS[2];
}

export function getDlqJobId(job: ScrapeJob): string {
  return `report-${job.reportId}`;
}

export function getJobCinemaId(job: ScrapeJob): string | undefined {
  if (job.type !== 'scrape') return undefined;
  return job.options?.cinemaId;
}

export function createDlqJobEntry({
  job,
  failureReason,
  retryCount,
  timestamp = new Date().toISOString(),
}: {
  job: ScrapeJob;
  failureReason: string;
  retryCount: number;
  timestamp?: string;
}): DlqJobEntry {
  return {
    job_id: getDlqJobId(job),
    failure_reason: failureReason,
    retry_count: retryCount,
    timestamp,
    cinema_id: getJobCinemaId(job),
    org_id: job.traceContext?.org_id,
    org_slug: job.traceContext?.org_slug,
    user_id: job.traceContext?.user_id,
    endpoint: job.traceContext?.endpoint,
    job,
  };
}

export function resetDlqJobForRetry(entry: DlqJobEntry): DlqJobEntry {
  return {
    ...entry,
    retry_count: 0,
    job: {
      ...entry.job,
      retryCount: 0,
    },
  };
}

export function matchesDlqOrg(entry: DlqJobEntry, orgId?: number): boolean {
  if (orgId === undefined) return true;
  return entry.org_id === String(orgId);
}

/**
 * Creates a structured JSON logger.
 * - In production (NODE_ENV=production): outputs JSON (for Loki ingestion)
 * - In development: outputs colorized, human-readable text
 */
export function createLogger(serviceName: string, level?: string) {
  return winston.createLogger({
    level: level ?? process.env.LOG_LEVEL ?? 'info',
    defaultMeta: { service: serviceName },
    format: isProduction
      ? combine(timestamp(), json())
      : combine(colorize(), simple()),
    transports: [
      new winston.transports.Console(),
    ],
  });
}
