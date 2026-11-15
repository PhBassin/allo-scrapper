/**
 * End-to-end (in-process) runs of the real `runScraper` against an in-memory
 * `scrape_attempts` store, to check what a run leaves behind: the attempts it
 * records, the report status derived from them, and the schedule run status.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScrapeAttempt } from '../../../src/db/scrape-attempt-queries.js';

type AttemptStatus = ScrapeAttempt['status'];
interface StoredAttempt {
  id: number;
  report_id: number;
  theater_id: string;
  date: string;
  status: AttemptStatus;
  error_type?: string;
}

const store: StoredAttempt[] = [];
let nextId = 1;

const mockUpdateScrapeReport = vi.fn();
const mockUpdateScheduleRunStatus = vi.fn();

vi.mock('../../../src/db/scrape-attempt-queries.js', () => ({
  createScrapeAttempt: vi.fn(async (_db: unknown, input: Omit<StoredAttempt, 'id' | 'status'> & { status?: AttemptStatus }) => {
    const status = input.status ?? 'pending';
    const existing = store.find(
      a => a.report_id === input.report_id && a.theater_id === input.theater_id && a.date === input.date
    );
    if (existing) {
      existing.status = status;
      return existing.id;
    }
    const id = nextId++;
    store.push({ id, report_id: input.report_id, theater_id: input.theater_id, date: input.date, status });
    return id;
  }),
  updateScrapeAttempt: vi.fn(async (_db: unknown, id: number, data: Partial<StoredAttempt>) => {
    const attempt = store.find(a => a.id === id);
    if (attempt) Object.assign(attempt, data);
  }),
  getScrapeAttemptsByReport: vi.fn(async (_db: unknown, reportId: number) =>
    store.filter(a => a.report_id === reportId)
  ),
}));

vi.mock('../../../src/db/report-queries.js', () => ({
  updateScrapeReport: (...args: unknown[]) => mockUpdateScrapeReport(...args),
}));

vi.mock('../../../src/db/schedule-queries.js', () => ({
  updateScheduleRunStatus: (...args: unknown[]) => mockUpdateScheduleRunStatus(...args),
}));

const THEATERS = [
  { id: 'C0001', name: 'Theater One', url: 'https://example.com/1', source: 'allocine' },
  { id: 'C0074', name: 'Reflet Médicis', url: 'https://example.com/74', source: 'allocine' },
  { id: 'C0099', name: 'Theater Three', url: 'https://example.com/99', source: 'allocine' },
];
const DATES = ['2026-03-10', '2026-03-11'];

vi.mock('../../../src/db/theater-queries.js', () => ({
  getTheaterConfigs: vi.fn(async () => THEATERS),
  getTheaters: vi.fn(async () => THEATERS),
}));

const mockScrapeTheater = vi.fn();
const mockStrategy = {
  sourceName: 'allocine',
  loadTheaterMetadata: vi.fn(async () => ({ availableDates: DATES, theater: THEATERS[0] })),
  scrapeTheater: (...args: unknown[]) => mockScrapeTheater(...args),
};

vi.mock('../../../src/scraper/strategy-factory.js', () => ({
  getStrategyByUrl: vi.fn(() => mockStrategy),
  getStrategyBySource: vi.fn(() => mockStrategy),
}));

vi.mock('../../../src/scraper/http-client.js', () => ({
  delay: vi.fn().mockResolvedValue(undefined),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/db/client.js', () => ({ db: {} }));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/utils/date.js', () => ({
  getScrapeDates: vi.fn(() => DATES),
}));

import { runScraper } from '../../../src/scraper/index.js';
import { completeScrapeReport } from '../../../src/scraper/report-status.js';
import { RateLimitError } from '../../../src/utils/errors.js';

const PARENT_REPORT_ID = 20;
const RESUME_REPORT_ID = 21;
const SCHEDULE_ID = 7;

/** Theater C0074 answers 429 on its first date; every other pair succeeds. */
function rateLimitOnReflet() {
  mockScrapeTheater.mockImplementation(async (_db: unknown, theater: { id: string }, date: string) => {
    if (theater.id === 'C0074' && date === DATES[0]) {
      throw new RateLimitError('HTTP 429 Too Many Requests', 429, 'https://example.com/74');
    }
    return { moviesCount: 3, showtimesCount: 9 };
  });
}

function pairsOf(reportId: number) {
  return store
    .filter(a => a.report_id === reportId)
    .map(a => `${a.theater_id}@${a.date}:${a.status}`)
    .sort();
}

describe('a scheduled run rate-limited mid-way', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.length = 0;
    nextId = 1;
    process.env.THEATER_DELAY_MS = '0';
    process.env.MOVIE_DELAY_MS = '0';
  });

  it('cascades not_attempted, ends with a rate_limited report and a partial_success schedule', async () => {
    rateLimitOnReflet();

    const summary = await runScraper(undefined, { reportId: PARENT_REPORT_ID });
    const status = await completeScrapeReport({} as never, PARENT_REPORT_ID, summary, {
      scheduleId: SCHEDULE_ID,
    });

    expect(pairsOf(PARENT_REPORT_ID)).toEqual([
      'C0001@2026-03-10:success',
      'C0001@2026-03-11:success',
      'C0074@2026-03-10:rate_limited',
      'C0074@2026-03-11:not_attempted',
      'C0099@2026-03-10:not_attempted',
      'C0099@2026-03-11:not_attempted',
    ].sort());
    expect(status).toBe('rate_limited');
    expect(mockUpdateScrapeReport).toHaveBeenCalledWith(
      expect.anything(),
      PARENT_REPORT_ID,
      expect.objectContaining({ status: 'rate_limited' })
    );
    expect(mockUpdateScheduleRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      SCHEDULE_ID,
      'partial_success'
    );
  });

  it('a resume of that report only records the rate-limited and not-attempted pairs', async () => {
    rateLimitOnReflet();
    await runScraper(undefined, { reportId: PARENT_REPORT_ID });

    // What `POST /api/scraper/resume/:reportId` sends: the parent's
    // failed | rate_limited | not_attempted pairs.
    const pendingAttempts = store
      .filter(a => a.report_id === PARENT_REPORT_ID && a.status !== 'success')
      .map(({ theater_id, date }) => ({ theater_id, date }));

    mockScrapeTheater.mockResolvedValue({ moviesCount: 3, showtimesCount: 9 });
    const summary = await runScraper(undefined, {
      reportId: RESUME_REPORT_ID,
      resumeMode: true,
      pendingAttempts,
    });
    const status = await completeScrapeReport({} as never, RESUME_REPORT_ID, summary);

    expect(pairsOf(RESUME_REPORT_ID)).toEqual([
      'C0074@2026-03-10:success',
      'C0074@2026-03-11:success',
      'C0099@2026-03-10:success',
      'C0099@2026-03-11:success',
    ].sort());
    expect(status).toBe('success');
  });
});

describe('a resume run that scrapes none of its pending pairs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.length = 0;
    nextId = 1;
    process.env.THEATER_DELAY_MS = '0';
    process.env.MOVIE_DELAY_MS = '0';
  });

  it('fails without loading any theater when the pairs fall outside the scrape window', async () => {
    const pendingAttempts = [
      { theater_id: 'C0074', date: '2026-03-01' },
      { theater_id: 'C0099', date: '2026-03-02' },
    ];

    const summary = await runScraper(undefined, {
      reportId: RESUME_REPORT_ID,
      resumeMode: true,
      pendingAttempts,
    });
    const status = await completeScrapeReport({} as never, RESUME_REPORT_ID, summary, {
      resumeMode: true,
    });

    expect(mockStrategy.loadTheaterMetadata).not.toHaveBeenCalled();
    expect(mockScrapeTheater).not.toHaveBeenCalled();
    expect(pairsOf(RESUME_REPORT_ID)).toEqual([]);
    expect(summary.successful_theaters).toBe(0);
    expect(status).toBe('failed');
  });

  it('fails when the source does not publish the pending dates', async () => {
    mockStrategy.loadTheaterMetadata.mockResolvedValueOnce({ availableDates: [DATES[1]], theater: THEATERS[1] });
    const pendingAttempts = [{ theater_id: 'C0074', date: DATES[0] }];

    const summary = await runScraper(undefined, {
      reportId: RESUME_REPORT_ID,
      resumeMode: true,
      pendingAttempts,
    });
    const status = await completeScrapeReport({} as never, RESUME_REPORT_ID, summary, {
      resumeMode: true,
    });

    expect(mockScrapeTheater).not.toHaveBeenCalled();
    expect(pairsOf(RESUME_REPORT_ID)).toEqual([]);
    expect(status).toBe('failed');
  });
});
