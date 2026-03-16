import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (must be declared before any imports of the module under test) ---

const mockRunScraper = vi.fn();
const mockAddCinemaAndScrape = vi.fn();
const mockUpdateScrapeReport = vi.fn().mockResolvedValue(undefined);
const mockGetRedisPublisher = vi.fn().mockReturnValue({ emit: vi.fn() });
const mockScrapeJobsTotal = { inc: vi.fn() };
const mockScrapeDurationSeconds = { startTimer: vi.fn().mockReturnValue(vi.fn()) };
const mockFilmsScrapedTotal = { inc: vi.fn() };
const mockShowtimesScrapedTotal = { inc: vi.fn() };

vi.mock('../../src/scraper/index.js', () => ({
  runScraper: mockRunScraper,
  addCinemaAndScrape: mockAddCinemaAndScrape,
}));

vi.mock('../../src/db/report-queries.js', () => ({
  createScrapeReport: vi.fn().mockResolvedValue(1),
  updateScrapeReport: (...args: any[]) => mockUpdateScrapeReport(...args),
}));

vi.mock('../../src/redis/client.js', () => ({
  getRedisPublisher: mockGetRedisPublisher,
  getRedisConsumer: vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() }),
  disconnectRedis: vi.fn(),
}));

vi.mock('../../src/db/client.js', () => ({
  db: { end: vi.fn() },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/utils/metrics.js', () => ({
  registry: {},
  scrapeJobsTotal: mockScrapeJobsTotal,
  scrapeDurationSeconds: mockScrapeDurationSeconds,
  filmsScrapedTotal: mockFilmsScrapedTotal,
  showtimesScrapedTotal: mockShowtimesScrapedTotal,
}));

vi.mock('../../src/utils/tracer.js', () => ({
  initTracing: vi.fn(),
}));

// --- Import the function under test (after mocks) ---
// We test executeJob indirectly by exercising it through the exported
// function. Since executeJob is not exported, we test it via its
// integration points: the mocked runScraper and addCinemaAndScrape.

// We import executeJob by re-exporting it for test purposes via a
// helper that mirrors what the module does. Instead, we extract it via
// a workaround: dynamically import the module and call the job handler.

// The cleanest approach: test the dispatcher logic as a pure unit.
// We'll import the module to exercise its exports, and inspect which
// scraper function gets called.

describe('executeJob dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeDurationSeconds.startTimer.mockReturnValue(vi.fn());
  });

  it('should dispatch scrape jobs to runScraper', async () => {
    mockRunScraper.mockResolvedValue({
      failed_cinemas: 0,
      successful_cinemas: 1,
      total_cinemas: 1,
      total_films: 5,
      total_showtimes: 20,
      errors: [],
    });

    // Dynamically import to pick up mocks
    const { executeJob } = await import('../../src/index.js');

    await executeJob({
      type: 'scrape',
      triggerType: 'manual',
      reportId: 42,
      options: { mode: 'from_today_limited' },
    });

    expect(mockRunScraper).toHaveBeenCalledOnce();
    expect(mockAddCinemaAndScrape).not.toHaveBeenCalled();
  });

  it('should dispatch add_cinema jobs to addCinemaAndScrape', async () => {
    mockAddCinemaAndScrape.mockResolvedValue({
      id: 'C0072',
      name: 'Cinéma Test',
      url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html',
    });

    const { executeJob } = await import('../../src/index.js');

    await executeJob({
      type: 'add_cinema',
      triggerType: 'manual',
      reportId: 43,
      url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html',
    });

    expect(mockAddCinemaAndScrape).toHaveBeenCalledOnce();
    expect(mockRunScraper).not.toHaveBeenCalled();
  });

  it('should handle legacy jobs without type field as scrape', async () => {
    mockRunScraper.mockResolvedValue({
      failed_cinemas: 0,
      successful_cinemas: 1,
      total_cinemas: 1,
      total_films: 3,
      total_showtimes: 10,
      errors: [],
    });

    const { executeJob } = await import('../../src/index.js');

    // Cast as any to simulate legacy job without 'type' field
    await executeJob({
      triggerType: 'cron',
      reportId: 44,
    } as any);

    expect(mockRunScraper).toHaveBeenCalledOnce();
    expect(mockAddCinemaAndScrape).not.toHaveBeenCalled();
  });

  it('should reject add_cinema jobs and update report to failed on error', async () => {
    mockAddCinemaAndScrape.mockRejectedValue(new Error('Invalid Allociné URL: bad-url'));

    const { executeJob } = await import('../../src/index.js');

    // Should not throw — errors are caught and reported
    await expect(executeJob({
      type: 'add_cinema',
      triggerType: 'manual',
      reportId: 45,
      url: 'bad-url',
    })).resolves.toBeUndefined();

    // Should have updated report to failed
    expect(mockUpdateScrapeReport).toHaveBeenCalledWith(
      expect.anything(),
      45,
      expect.objectContaining({ status: 'failed' })
    );
  });
});
