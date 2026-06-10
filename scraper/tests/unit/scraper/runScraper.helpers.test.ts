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
