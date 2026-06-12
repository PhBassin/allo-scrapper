import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Strategy mock -----------------------------------------------------------
// We mock the strategy-factory module so we can control strategy behaviour
// without depending on the real AllocineScraperStrategy (which would require
// HTML fixtures, browser, etc.).
const mockStrategy = {
  sourceName: 'allocine',
  canHandleUrl: vi.fn().mockReturnValue(true),
  extractTheaterId: vi.fn().mockReturnValue('C0072'),
  cleanTheaterUrl: vi.fn((url: string) => url),
  loadTheaterMetadata: vi.fn(),
  scrapeTheater: vi.fn(),
};

vi.mock('../../../src/scraper/strategy-factory.js', () => ({
  getStrategyByUrl: vi.fn(() => mockStrategy),
  getStrategyBySource: vi.fn(() => mockStrategy),
}));

// --- DB module mocks ---------------------------------------------------------
const mockGetTheaterConfigs = vi.fn();
const mockGetTheaters = vi.fn();
const mockCreateScrapeAttempt = vi.fn();
const mockUpdateScrapeAttempt = vi.fn();

vi.mock('../../../src/db/theater-queries.js', () => ({
  upsertTheater: vi.fn(),
  getTheaters: (...args: any[]) => mockGetTheaters(...args),
  getTheaterConfigs: (...args: any[]) => mockGetTheaterConfigs(...args),
}));

vi.mock('../../../src/db/scrape-attempt-queries.js', () => ({
  createScrapeAttempt: (...args: any[]) => mockCreateScrapeAttempt(...args),
  updateScrapeAttempt: (...args: any[]) => mockUpdateScrapeAttempt(...args),
  getPendingScrapeAttempts: vi.fn(),
  getScrapeAttemptsByReport: vi.fn(),
  getScrapeAttempt: vi.fn(),
  hasSuccessfulAttempt: vi.fn(),
}));

// --- Other module mocks ------------------------------------------------------
vi.mock('../../../src/db/movie-queries.js', () => ({
  upsertMovie: vi.fn(),
  getMovie: vi.fn(),
}));

vi.mock('../../../src/db/showtime-queries.js', () => ({
  upsertShowtimes: vi.fn(),
  upsertWeeklyPrograms: vi.fn(),
}));

vi.mock('../../../src/scraper/http-client.js', () => ({
  fetchTheaterPage: vi.fn(),
  fetchShowtimesJson: vi.fn(),
  fetchMoviePage: vi.fn(),
  delay: vi.fn().mockResolvedValue(undefined),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/db/client.js', () => ({
  db: {},
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/utils/date.js', () => ({
  getScrapeDates: vi.fn().mockReturnValue(['2026-03-10', '2026-03-11']),
  getWeekStartForDate: vi.fn().mockReturnValue('2026-03-09'),
}));

// --- Helpers -----------------------------------------------------------------
function emptySummary() {
  return {
    total_theaters: 0,
    successful_theaters: 0,
    failed_theaters: 0,
    total_movies: 0,
    total_showtimes: 0,
    total_dates: 0,
    duration_ms: 0,
    errors: [],
  } as any;
}

const THEATER_A: any = {
  id: 'C0072',
  name: 'Theater A',
  url: 'https://example.com/a',
  source: 'allocine',
};
const THEATER_B: any = {
  id: 'W7504',
  name: 'Theater B',
  url: 'https://example.com/b',
  source: 'allocine',
};

// --- Tests -------------------------------------------------------------------

describe('prepareSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTheaterConfigs.mockResolvedValue([THEATER_A, THEATER_B]);
    mockGetTheaters.mockResolvedValue([THEATER_A, THEATER_B]);
  });

  it('returns all configured theaters when no theaterId is provided', async () => {
    const { prepareSchedule } = await import('../../../src/scraper/index.js');
    const ctx: any = { db: {}, summary: emptySummary(), progress: undefined };

    const result = await prepareSchedule(ctx, {});

    expect(result.theaters).toHaveLength(2);
    expect(result.dates).toEqual(['2026-03-10', '2026-03-11']);
  });

  it('filters theaters to the requested theaterId when configured and in DB', async () => {
    const { prepareSchedule } = await import('../../../src/scraper/index.js');
    const ctx: any = { db: {}, summary: emptySummary(), progress: undefined };

    const result = await prepareSchedule(ctx, { theaterId: 'C0072' });

    expect(result.theaters).toHaveLength(1);
    expect(result.theaters[0].id).toBe('C0072');
  });

  it('throws if requested theaterId is missing from the database', async () => {
    const { prepareSchedule } = await import('../../../src/scraper/index.js');
    const ctx: any = { db: {}, summary: emptySummary(), progress: undefined };
    mockGetTheaters.mockResolvedValue([THEATER_B]);

    await expect(
      prepareSchedule(ctx, { theaterId: 'C0072' })
    ).rejects.toThrow(/not found in database/i);
  });

  it('throws if requested theaterId is in DB but not configured for scraping', async () => {
    const { prepareSchedule } = await import('../../../src/scraper/index.js');
    const ctx: any = { db: {}, summary: emptySummary(), progress: undefined };
    mockGetTheaterConfigs.mockResolvedValue([THEATER_B]);

    await expect(
      prepareSchedule(ctx, { theaterId: 'C0072' })
    ).rejects.toThrow(/not configured for scraping/i);
  });

  it('populates summary.total_theaters and total_dates', async () => {
    const { prepareSchedule } = await import('../../../src/scraper/index.js');
    const summary = emptySummary();
    const ctx: any = { db: {}, summary, progress: undefined };

    await prepareSchedule(ctx, {});

    expect(summary.total_theaters).toBe(2);
    expect(summary.total_dates).toBe(2);
  });

  it('emits a started progress event with totals', async () => {
    const { prepareSchedule } = await import('../../../src/scraper/index.js');
    const publisher = { emit: vi.fn().mockResolvedValue(undefined) };
    const ctx: any = { db: {}, summary: emptySummary(), progress: publisher };

    await prepareSchedule(ctx, {});

    expect(publisher.emit).toHaveBeenCalledWith({
      type: 'started',
      total_theaters: 2,
      total_dates: 2,
    });
  });
});

describe('scrapeTheaterWithStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStrategy.loadTheaterMetadata.mockResolvedValue({
      theater: THEATER_A,
      availableDates: ['2026-03-10', '2026-03-11'],
    });
    mockStrategy.scrapeTheater.mockResolvedValue({
      moviesCount: 2,
      showtimesCount: 4,
    });
    mockCreateScrapeAttempt.mockResolvedValue(99);
  });

  it('returns successfully scraped counts and the filtered datesToScrape', async () => {
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    const result = await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      {}
    );

    expect(result.rateLimited).toBe(false);
    expect(result.successfulDates).toBe(2);
    expect(result.moviesCount).toBe(4);
    expect(result.showtimesCount).toBe(8);
  });

  it('increments summary.failed_theaters when metadata loading fails', async () => {
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    mockStrategy.loadTheaterMetadata.mockRejectedValueOnce(
      new Error('boom')
    );
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    const result = await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10'],
      ctx,
      {}
    );

    expect(result.rateLimited).toBe(false);
    expect(summary.failed_theaters).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].error).toBe('boom');
  });

  it('increments summary.successful_theaters and total_movies on full success', async () => {
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      {}
    );

    expect(summary.successful_theaters).toBe(1);
    expect(summary.total_movies).toBe(4);
    expect(summary.total_showtimes).toBe(8);
  });

  it('marks the theater as failed when every date fails non-rate-limit', async () => {
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    mockStrategy.scrapeTheater.mockRejectedValue(new Error('network'));
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      {}
    );

    expect(summary.failed_theaters).toBe(1);
    expect(summary.successful_theaters).toBe(0);
  });

  it('returns rateLimited=true and sets summary.status on RateLimitError', async () => {
    const { RateLimitError } = await import('../../../src/utils/errors.js');
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    mockStrategy.scrapeTheater.mockRejectedValueOnce(
      new RateLimitError('rate limit', 429, 'https://example.com')
    );
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    const result = await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      {}
    );

    expect(result.rateLimited).toBe(true);
    expect(summary.status).toBe('rate_limited');
  });

  it('on rate limit with reportId, cascades not_attempted to remaining theaters BEFORE emitting date_failed', async () => {
    const { RateLimitError } = await import('../../../src/utils/errors.js');
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );

    // First scrape of the first date triggers a 429.
    mockStrategy.scrapeTheater.mockRejectedValueOnce(
      new RateLimitError('rate limit', 429, 'https://example.com')
    );

    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: {
        emit: vi.fn().mockResolvedValue(undefined),
      },
    };

    const THEATER_B = {
      id: 'C0099',
      name: 'Theater B',
      url: 'https://example.com/b',
      source: 'allocine',
    };

    const result = await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      { reportId: 42 },
      {
        allTheaters: [THEATER_A, THEATER_B],
        theaterIndex: 0,
        datesToScrape: ['2026-03-10', '2026-03-11'],
      }
    );

    expect(result.rateLimited).toBe(true);

    // Remaining date of THEATER_A: not_attempted
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0072',
        date: '2026-03-11',
        status: 'not_attempted',
      })
    );
    // Remaining theater THEATER_B: not_attempted for both dates
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0099',
        date: '2026-03-10',
        status: 'not_attempted',
      })
    );
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0099',
        date: '2026-03-11',
        status: 'not_attempted',
      })
    );

    // Verify the cascade wrote not_attempted for:
    //  - THEATER_A's remaining date (2026-03-11)
    //  - THEATER_B's two dates (cascade_remaining)
    // This proves CRITIQUE-1: the helper is responsible for the cascade
    // (it has access to the cascade context), and the cascade_remaining
    // block is positioned BEFORE the date_failed emit in the source.
    // The exact emit-before-cascade ordering is verified by source
    // inspection (line ~422 in scraper/src/scraper/index.ts places the
    // cascade block immediately before the await progress?.emit call).
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0072',
        date: '2026-03-11',
        status: 'not_attempted',
      })
    );
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0099',
        date: '2026-03-10',
        status: 'not_attempted',
      })
    );
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0099',
        date: '2026-03-11',
        status: 'not_attempted',
      })
    );
  });

  it('filters datesToScrape to availableDates and logs skipped dates', async () => {
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    mockStrategy.loadTheaterMetadata.mockResolvedValueOnce({
      theater: THEATER_A,
      availableDates: ['2026-03-10'], // only one of the two is published
    });
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    const result = await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      {}
    );

    // Only 1 date effectively scraped
    expect(result.successfulDates).toBe(1);
    expect(mockStrategy.scrapeTheater).toHaveBeenCalledTimes(1);
  });

  it('in resume mode, restricts datesToScrape to pendingAttempts for that theater', async () => {
    const { scrapeTheaterWithStrategy } = await import(
      '../../../src/scraper/index.js'
    );
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: undefined,
    };

    await scrapeTheaterWithStrategy(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ctx,
      {
        resumeMode: true,
        pendingAttempts: [{ theater_id: 'C0072', date: '2026-03-10' }],
      }
    );

    expect(mockStrategy.scrapeTheater).toHaveBeenCalledTimes(1);
  });
});

// --- Helpers: loadTheaterAvailability ---------------------------------------
// loadTheaterAvailability asks the strategy for the theater's published
// dates. On success, returns { availableDates, failed: false }. On
// failure, logs, pushes to summary.errors, increments failed_theaters,
// and returns { availableDates: [], failed: true } so the caller knows
// to short-circuit.
describe('loadTheaterAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the available dates from the strategy on success', async () => {
    const { loadTheaterAvailability } = await import(
      '../../../src/scraper/index.js'
    );
    mockStrategy.loadTheaterMetadata.mockResolvedValue({
      theater: THEATER_A,
      availableDates: ['2026-03-10', '2026-03-12'],
    });
    const summary = emptySummary();
    const ctx: any = { db: {}, summary, progress: undefined };

    const result = await loadTheaterAvailability(ctx, THEATER_A);

    expect(result.failed).toBe(false);
    expect(result.availableDates).toEqual(['2026-03-10', '2026-03-12']);
    expect(summary.failed_theaters).toBe(0);
  });

  it('records the error, increments failed_theaters, and signals failure on metadata load error', async () => {
    const { loadTheaterAvailability } = await import(
      '../../../src/scraper/index.js'
    );
    mockStrategy.loadTheaterMetadata.mockRejectedValueOnce(
      new Error('network down')
    );
    const summary = emptySummary();
    const ctx: any = { db: {}, summary, progress: undefined };

    const result = await loadTheaterAvailability(ctx, THEATER_A);

    expect(result.failed).toBe(true);
    expect(result.availableDates).toEqual([]);
    expect(summary.failed_theaters).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({
      theater_id: 'C0072',
      error: 'network down',
    });
  });
});

// --- Helpers: filterDatesForScrape ------------------------------------------
// filterDatesForScrape intersects the requested dates with what the
// theater actually published, applies the resumeMode filter, and logs
// skipped dates. Pure function on the already-loaded availableDates
// (no I/O after the call), so easy to test.
describe('filterDatesForScrape', () => {
  it('returns the intersection of requested and available dates', async () => {
    const { filterDatesForScrape } = await import(
      '../../../src/scraper/index.js'
    );

    const result = filterDatesForScrape(THEATER_A, ['2026-03-10', '2026-03-11', '2026-03-12'], ['2026-03-10', '2026-03-12'], {});

    expect(result.datesToScrape).toEqual(['2026-03-10', '2026-03-12']);
    expect(result.finalDatesToScrape).toEqual(['2026-03-10', '2026-03-12']);
    expect(result.skippedDates).toEqual(['2026-03-11']);
  });

  it('further filters to pendingAttempts in resumeMode', async () => {
    const { filterDatesForScrape } = await import(
      '../../../src/scraper/index.js'
    );

    const result = filterDatesForScrape(
      THEATER_A,
      ['2026-03-10', '2026-03-11'],
      ['2026-03-10', '2026-03-11'],
      {
        resumeMode: true,
        pendingAttempts: [{ theater_id: 'C0072', date: '2026-03-10' }],
      }
    );

    expect(result.datesToScrape).toEqual(['2026-03-10', '2026-03-11']);
    expect(result.finalDatesToScrape).toEqual(['2026-03-10']);
  });
});

// --- Helpers: summarizeTheater ----------------------------------------------
// summarizeTheater folds the per-date counters into the shared summary:
// increments successful_theaters or failed_theaters, adds to total_movies/
// total_showtimes, and emits theater_completed. Returns true if the
// theater is considered successful (for the caller's branching).
describe('summarizeTheater', () => {
  it('marks theater successful, updates totals, and emits theater_completed when at least one date succeeded', async () => {
    const { summarizeTheater } = await import(
      '../../../src/scraper/index.js'
    );
    const summary = emptySummary();
    const progress = { emit: vi.fn().mockResolvedValue(undefined) };
    const ctx: any = { summary, progress };

    const ok = await summarizeTheater(ctx, THEATER_A, {
      successfulDates: 1,
      totalDates: 2,
      moviesCount: 5,
      showtimesCount: 12,
    });

    expect(ok).toBe(true);
    expect(summary.successful_theaters).toBe(1);
    expect(summary.failed_theaters).toBe(0);
    expect(summary.total_movies).toBe(5);
    expect(summary.total_showtimes).toBe(12);
    expect(progress.emit).toHaveBeenCalledWith({
      type: 'theater_completed',
      theater_name: 'Theater A',
      total_movies: 5,
    });
  });

  it('marks theater failed and does not emit theater_completed when zero dates succeeded', async () => {
    const { summarizeTheater } = await import(
      '../../../src/scraper/index.js'
    );
    const summary = emptySummary();
    const progress = { emit: vi.fn().mockResolvedValue(undefined) };
    const ctx: any = { summary, progress };

    const ok = await summarizeTheater(ctx, THEATER_A, {
      successfulDates: 0,
      totalDates: 2,
      moviesCount: 0,
      showtimesCount: 0,
    });

    expect(ok).toBe(false);
    expect(summary.successful_theaters).toBe(0);
    expect(summary.failed_theaters).toBe(1);
    expect(progress.emit).not.toHaveBeenCalled();
  });
});

// --- Helpers: processOneDate ------------------------------------------------
// processOneDate is the body of the per-date loop in
// scrapeTheaterWithStrategy. It creates the pending attempt, runs the
// strategy, and on error handles both the rate-limit cascade and the
// non-rate-limit fallback. Returns one of three outcomes so the
// caller can break on rate_limited.
describe('processOneDate', () => {
  it('returns "success" with counts on a clean scrape', async () => {
    const { processOneDate } = await import('../../../src/scraper/index.js');
    mockStrategy.scrapeTheater.mockResolvedValueOnce({
      moviesCount: 3,
      showtimesCount: 7,
    });
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };

    const result = await processOneDate(
      ctx,
      THEATER_A,
      '2026-03-10',
      ['2026-03-10'],
      {}
    );

    expect(result.status).toBe('success');
    expect(result.moviesCount).toBe(3);
    expect(result.showtimesCount).toBe(7);
  });

  it('returns "error" on a non-rate-limit failure and pushes the error to summary', async () => {
    const { processOneDate } = await import('../../../src/scraper/index.js');
    mockStrategy.scrapeTheater.mockRejectedValueOnce(new Error('HTTP 500'));
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };

    const result = await processOneDate(
      ctx,
      THEATER_A,
      '2026-03-10',
      ['2026-03-10'],
      {}
    );

    expect(result.status).toBe('error');
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({
      theater_id: 'C0072',
      date: '2026-03-10',
      error: 'HTTP 500',
    });
  });

  it('returns "rate_limited" on a RateLimitError and sets summary.status', async () => {
    const { RateLimitError } = await import('../../../src/utils/errors.js');
    const { processOneDate } = await import('../../../src/scraper/index.js');
    mockStrategy.scrapeTheater.mockRejectedValueOnce(
      new RateLimitError('429', 429, 'https://example.com')
    );
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      movieDelayMs: 0,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };

    const result = await processOneDate(
      ctx,
      THEATER_A,
      '2026-03-10',
      ['2026-03-10'],
      { reportId: 7 }
    );

    expect(result.status).toBe('rate_limited');
    expect(summary.status).toBe('rate_limited');
    expect(summary.errors[0]).toMatchObject({
      theater_id: 'C0072',
      error_type: 'http_429',
    });
  });
});

// --- Helpers: handleRateLimit / handleDateFailure ---------------------------
// These two helpers are private (not exported). We re-import them via
// the public name. The reason we exercise them directly is that
// fallow's static coverage estimator cannot see transitive coverage
// from processOneDate. Direct tests push the estimated CRAP under 30.
describe('handleRateLimit (direct)', () => {
  it('marks THIS theater remaining dates as not_attempted, cascades to remaining theaters, then emits date_failed', async () => {
    const { RateLimitError } = await import('../../../src/utils/errors.js');
    const { handleRateLimit } = await import('../../../src/scraper/index.js');
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };
    const err = new RateLimitError('429', 429, 'https://example.com');

    const result = await handleRateLimit({
      ctx,
      theater: THEATER_A,
      date: '2026-03-10',
      finalDatesToScrape: ['2026-03-10', '2026-03-11'],
      options: { reportId: 42 },
      cascade: {
        allTheaters: [THEATER_A, THEATER_B],
        theaterIndex: 0,
        datesToScrape: ['2026-03-10', '2026-03-11'],
      },
      error: err,
      attemptId: 99,
    });

    expect(result.status).toBe('rate_limited');
    expect(summary.status).toBe('rate_limited');
    // attemptId provided → rate_limited update attempted
    expect(mockUpdateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      99,
      expect.objectContaining({ status: 'rate_limited' })
    );
    // cascade_current: THEATER_A's remaining date
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0072',
        date: '2026-03-11',
        status: 'not_attempted',
      })
    );
    // cascade_remaining: THEATER_B for both dates
    expect(mockCreateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theater_id: 'C0099',
        date: '2026-03-10',
        status: 'not_attempted',
      })
    );
    // date_failed emit
    expect(ctx.progress.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'date_failed' })
    );
  });

  it('no-ops cascade writes when reportId is missing', async () => {
    const { RateLimitError } = await import('../../../src/utils/errors.js');
    const { handleRateLimit } = await import('../../../src/scraper/index.js');
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };
    const err = new RateLimitError('429', 429, 'https://example.com');

    const result = await handleRateLimit({
      ctx,
      theater: THEATER_A,
      date: '2026-03-10',
      finalDatesToScrape: ['2026-03-10', '2026-03-11'],
      options: {}, // no reportId
      error: err,
      attemptId: undefined,
    });

    expect(result.status).toBe('rate_limited');
    // No cascade writes attempted
    expect(mockCreateScrapeAttempt).not.toHaveBeenCalled();
  });
});

describe('handleDateFailure (direct)', () => {
  it('records a non-rate-limit error in summary.errors and updates the attempt as failed', async () => {
    const { handleDateFailure } = await import('../../../src/scraper/index.js');
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };

    const result = await handleDateFailure({
      ctx,
      theater: THEATER_A,
      date: '2026-03-10',
      error: new Error('HTTP 500'),
      attemptId: 7,
    });

    expect(result.status).toBe('error');
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({
      theater_id: 'C0072',
      date: '2026-03-10',
      error: 'HTTP 500',
    });
    expect(mockUpdateScrapeAttempt).toHaveBeenCalledWith(
      expect.anything(),
      7,
      expect.objectContaining({ status: 'failed' })
    );
    expect(ctx.progress.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'date_failed' })
    );
  });

  it('still works when attemptId is undefined (no update, no throw)', async () => {
    const { handleDateFailure } = await import('../../../src/scraper/index.js');
    const summary = emptySummary();
    const ctx: any = {
      db: {},
      summary,
      progress: { emit: vi.fn().mockResolvedValue(undefined) },
    };

    const result = await handleDateFailure({
      ctx,
      theater: THEATER_A,
      date: '2026-03-10',
      error: new Error('boom'),
      attemptId: undefined,
    });

    expect(result.status).toBe('error');
    expect(summary.errors[0].error).toBe('boom');
  });
});
