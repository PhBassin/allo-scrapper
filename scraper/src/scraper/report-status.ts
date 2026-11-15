import type { DB } from '../db/client.js';
import { getScrapeAttemptsByReport, type ScrapeAttempt } from '../db/scrape-attempt-queries.js';
import { updateScrapeReport } from '../db/report-queries.js';
import { updateScheduleRunStatus } from '../db/schedule-queries.js';
import { logger } from '../utils/logger.js';
import type { ScrapeSummary } from '../types/scraper.js';

/** Terminal status of a ScrapeReport once its run has finished. */
export type FinalReportStatus = 'success' | 'partial_success' | 'failed' | 'rate_limited';

/** Domain of `scrape_schedules.last_run_status` — it has no `rate_limited`. */
export type ScheduleRunStatus = 'success' | 'partial_success' | 'failed';

type AttemptStatus = ScrapeAttempt['status'];

/**
 * Attempt statuses meaning "this (theater, date) pair delivered data".
 * A report with none of them is `failed`. Extend this set when an attempt
 * can deliver data without being a full `success`.
 */
const DATA_DELIVERED_STATUSES: ReadonlySet<AttemptStatus> = new Set<AttemptStatus>(['success']);

/**
 * Derives a finished report's status. The report's ScrapeAttempts are the
 * source of truth (ADR 0003), in this priority:
 *   1. `rate_limited` if any attempt is `rate_limited`;
 *   2. `success` if every attempt is `success`;
 *   3. `failed` if no attempt delivered data;
 *   4. `partial_success` otherwise.
 * A run that recorded no attempt keeps the theater-counter rule, except a
 * Resume: it only plans the parent's pending pairs, so recording none means
 * it scraped nothing, and it is `failed`.
 */
export function deriveReportStatus(
  attempts: ReadonlyArray<Pick<ScrapeAttempt, 'status'>>,
  counters: Pick<ScrapeSummary, 'failed_theaters' | 'successful_theaters'>,
  options: { resumeMode?: boolean } = {}
): FinalReportStatus {
  if (attempts.length === 0) {
    return options.resumeMode ? 'failed' : deriveFromCounters(counters);
  }
  if (attempts.some(a => a.status === 'rate_limited')) return 'rate_limited';
  if (attempts.every(a => a.status === 'success')) return 'success';
  if (!attempts.some(a => DATA_DELIVERED_STATUSES.has(a.status))) return 'failed';
  return 'partial_success';
}

function deriveFromCounters(
  counters: Pick<ScrapeSummary, 'failed_theaters' | 'successful_theaters'>
): FinalReportStatus {
  if (counters.failed_theaters === 0) return 'success';
  return counters.successful_theaters > 0 ? 'partial_success' : 'failed';
}

/** Report error of a Resume that recorded no attempt. */
export const RESUME_SCRAPED_NOTHING_ERROR =
  'Resume recorded no attempt: no pending pair could be scraped (outside the scrape window, not published by the source, or theater no longer configured)';

/** A schedule records a rate-limited run as a partial success. */
export function toScheduleRunStatus(status: FinalReportStatus): ScheduleRunStatus {
  return status === 'rate_limited' ? 'partial_success' : status;
}

/**
 * Closes a finished run: derives the report status from the report's
 * attempts, stamps it with the run counters and, for a scheduled run,
 * records the schedule's last run status. Returns the derived status.
 * A Resume (`resumeMode`) that recorded no attempt is `failed`, with an
 * explanatory entry in the report errors.
 */
export async function completeScrapeReport(
  db: DB,
  reportId: number,
  summary: ScrapeSummary,
  options: { scheduleId?: number; resumeMode?: boolean } = {}
): Promise<FinalReportStatus> {
  let attempts: ScrapeAttempt[] = [];
  let attemptsRead = false;
  try {
    attempts = await getScrapeAttemptsByReport(db, reportId);
    attemptsRead = true;
  } catch (error) {
    logger.warn('Could not read the report attempts, deriving its status from counters', {
      reportId,
      error,
    });
  }

  // Unreadable attempts say nothing about what the Resume scraped: counters.
  const resumeScrapedNothing = Boolean(options.resumeMode) && attemptsRead && attempts.length === 0;
  const status = deriveReportStatus(attempts, summary, { resumeMode: resumeScrapedNothing });
  const errors = resumeScrapedNothing
    ? [
        ...summary.errors,
        { theater_name: 'System', theater_id: 'system', error: RESUME_SCRAPED_NOTHING_ERROR },
      ]
    : summary.errors;
  if (resumeScrapedNothing) {
    logger.warn('Resume recorded no attempt, marking its report failed', { reportId });
  }

  await updateScrapeReport(db, reportId, {
    status,
    completed_at: new Date().toISOString(),
    total_theaters: summary.total_theaters,
    successful_theaters: summary.successful_theaters,
    failed_theaters: summary.failed_theaters,
    total_movies_scraped: summary.total_movies,
    total_showtimes_scraped: summary.total_showtimes,
    errors,
  });

  if (options.scheduleId) {
    await updateScheduleRunStatus(db, options.scheduleId, toScheduleRunStatus(status));
  }

  return status;
}
