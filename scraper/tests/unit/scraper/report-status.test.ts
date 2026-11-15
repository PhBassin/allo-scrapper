import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../../../src/db/client.js';
import type { ScrapeAttempt } from '../../../src/db/scrape-attempt-queries.js';
import type { ScrapeSummary } from '../../../src/types/scraper.js';

const mockGetScrapeAttemptsByReport = vi.fn();
const mockUpdateScrapeReport = vi.fn();
const mockUpdateScheduleRunStatus = vi.fn();

vi.mock('../../../src/db/scrape-attempt-queries.js', () => ({
  getScrapeAttemptsByReport: (...args: unknown[]) => mockGetScrapeAttemptsByReport(...args),
}));

vi.mock('../../../src/db/report-queries.js', () => ({
  updateScrapeReport: (...args: unknown[]) => mockUpdateScrapeReport(...args),
}));

vi.mock('../../../src/db/schedule-queries.js', () => ({
  updateScheduleRunStatus: (...args: unknown[]) => mockUpdateScheduleRunStatus(...args),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  deriveReportStatus,
  toScheduleRunStatus,
  completeScrapeReport,
} from '../../../src/scraper/report-status.js';

type AttemptStatus = ScrapeAttempt['status'];

const attempts = (...statuses: AttemptStatus[]) => statuses.map(status => ({ status }));

const counters = (failed_theaters: number, successful_theaters: number) => ({
  failed_theaters,
  successful_theaters,
});

const MOCK_DB = {} as DB;

function summary(overrides: Partial<ScrapeSummary> = {}): ScrapeSummary {
  return {
    total_theaters: 3,
    successful_theaters: 2,
    failed_theaters: 1,
    total_movies: 12,
    total_showtimes: 40,
    total_dates: 2,
    duration_ms: 1000,
    errors: [],
    ...overrides,
  };
}

describe('deriveReportStatus', () => {
  describe('from attempts (priority order)', () => {
    it('is rate_limited as soon as one attempt is rate_limited', () => {
      expect(deriveReportStatus(attempts('success', 'rate_limited', 'not_attempted'), counters(0, 3)))
        .toBe('rate_limited');
    });

    it('is rate_limited even when no attempt succeeded', () => {
      expect(deriveReportStatus(attempts('rate_limited', 'not_attempted'), counters(0, 0)))
        .toBe('rate_limited');
    });

    it('is success when every attempt is success', () => {
      expect(deriveReportStatus(attempts('success', 'success'), counters(1, 0))).toBe('success');
    });

    it('is failed when no attempt is success', () => {
      expect(deriveReportStatus(attempts('failed', 'not_attempted', 'pending'), counters(0, 3)))
        .toBe('failed');
    });

    it('is partial_success when some attempts succeeded and others did not', () => {
      expect(deriveReportStatus(attempts('success', 'failed'), counters(0, 1))).toBe('partial_success');
    });

    it('is partial_success when a success sits next to a not_attempted or pending pair', () => {
      expect(deriveReportStatus(attempts('success', 'not_attempted'), counters(0, 1))).toBe('partial_success');
      expect(deriveReportStatus(attempts('success', 'pending'), counters(0, 1))).toBe('partial_success');
    });

    it('ignores the theater counters whenever attempts exist', () => {
      expect(deriveReportStatus(attempts('failed'), counters(0, 5))).toBe('failed');
    });
  });

  describe('with zero attempts (counter-based fallback)', () => {
    it('is success when no theater failed', () => {
      expect(deriveReportStatus([], counters(0, 3))).toBe('success');
    });

    it('is partial_success when some theaters failed and some succeeded', () => {
      expect(deriveReportStatus([], counters(1, 2))).toBe('partial_success');
    });

    it('is failed when every theater failed', () => {
      expect(deriveReportStatus([], counters(2, 0))).toBe('failed');
    });
  });
});

describe('toScheduleRunStatus', () => {
  it('records a rate_limited report as partial_success', () => {
    expect(toScheduleRunStatus('rate_limited')).toBe('partial_success');
  });

  it.each(['success', 'partial_success', 'failed'] as const)('keeps %s unchanged', (status) => {
    expect(toScheduleRunStatus(status)).toBe(status);
  });
});

describe('completeScrapeReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateScrapeReport.mockResolvedValue(undefined);
    mockUpdateScheduleRunStatus.mockResolvedValue(undefined);
  });

  it('stamps the report with the status derived from its attempts and the run counters', async () => {
    mockGetScrapeAttemptsByReport.mockResolvedValue(attempts('success', 'rate_limited', 'not_attempted'));
    const errors = [{ theater_name: 'A', theater_id: 'C1', error: '429', error_type: 'http_429' as const }];

    const status = await completeScrapeReport(MOCK_DB, 20, summary({ errors }));

    expect(status).toBe('rate_limited');
    expect(mockGetScrapeAttemptsByReport).toHaveBeenCalledWith(MOCK_DB, 20);
    expect(mockUpdateScrapeReport).toHaveBeenCalledWith(MOCK_DB, 20, {
      status: 'rate_limited',
      completed_at: expect.any(String),
      total_theaters: 3,
      successful_theaters: 2,
      failed_theaters: 1,
      total_movies_scraped: 12,
      total_showtimes_scraped: 40,
      errors,
    });
  });

  it('records the schedule run status when a schedule id is given', async () => {
    mockGetScrapeAttemptsByReport.mockResolvedValue(attempts('success', 'rate_limited'));

    await completeScrapeReport(MOCK_DB, 20, summary(), { scheduleId: 7 });

    expect(mockUpdateScheduleRunStatus).toHaveBeenCalledWith(MOCK_DB, 7, 'partial_success');
  });

  it('does not touch any schedule without a schedule id', async () => {
    mockGetScrapeAttemptsByReport.mockResolvedValue(attempts('success'));

    await completeScrapeReport(MOCK_DB, 20, summary());

    expect(mockUpdateScheduleRunStatus).not.toHaveBeenCalled();
  });

  it('falls back to the counters when the attempts cannot be read', async () => {
    mockGetScrapeAttemptsByReport.mockRejectedValue(new Error('db down'));

    const status = await completeScrapeReport(MOCK_DB, 20, summary({ failed_theaters: 0 }));

    expect(status).toBe('success');
    expect(mockUpdateScrapeReport).toHaveBeenCalledWith(
      MOCK_DB, 20, expect.objectContaining({ status: 'success' })
    );
  });
});
