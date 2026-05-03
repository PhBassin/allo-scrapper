import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (must be declared before any imports of the module under test) ---

const mockRunScraper = vi.fn();
const mockAddCinemaAndScrape = vi.fn();
const mockUpdateScrapeReport = vi.fn().mockResolvedValue(undefined);
const mockGetPendingScrapeAttempts = vi.fn();
const mockGetScrapeAttemptsByReport = vi.fn();
const mockGetCinemas = vi.fn();
const mockDbQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockPublisherEmit = vi.fn().mockResolvedValue(undefined);
const mockGetRedisPublisher = vi.fn().mockReturnValue({ emit: mockPublisherEmit });
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

vi.mock('../../src/db/scrape-attempt-queries.js', () => ({
  getPendingScrapeAttempts: (...args: any[]) => mockGetPendingScrapeAttempts(...args),
  getScrapeAttemptsByReport: (...args: any[]) => mockGetScrapeAttemptsByReport(...args),
}));

vi.mock('../../src/db/cinema-queries.js', () => ({
  getCinemas: (...args: any[]) => mockGetCinemas(...args),
}));

vi.mock('../../src/redis/client.js', () => ({
  getRedisPublisher: mockGetRedisPublisher,
  getRedisConsumer: vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() }),
  disconnectRedis: vi.fn(),
}));

vi.mock('../../src/db/client.js', () => ({
  db: { end: vi.fn(), query: (...args: any[]) => mockDbQuery(...args) },
  withTenantDb: vi.fn().mockImplementation(async (slug, run) => run({ end: vi.fn(), query: (...args: any[]) => mockDbQuery(...args) })),
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
    mockDbQuery.mockReset().mockResolvedValue({ rows: [] });
    mockGetPendingScrapeAttempts.mockReset();
    mockGetScrapeAttemptsByReport.mockReset().mockResolvedValue([]);
    mockGetCinemas.mockReset().mockResolvedValue([{ id: 'C0001', name: 'Cinema 1' }]);
    mockPublisherEmit.mockReset().mockResolvedValue(undefined);
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
    expect(mockRunScraper).toHaveBeenCalledWith(
      expect.objectContaining({ emit: mockPublisherEmit }),
      expect.objectContaining({
        reportId: 42,
      }),
      expect.anything(),
    );
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

  it('should rethrow scraper failures when consumer mode requests propagation', async () => {
    const failure = new Error('redis downstream failure');
    mockRunScraper.mockRejectedValue(failure);

    const { executeJob } = await import('../../src/index.js');

    await expect(executeJob({
      type: 'scrape',
      triggerType: 'manual',
      reportId: 46,
    }, { rethrowOnFailure: true })).rejects.toThrow('redis downstream failure');

    expect(mockUpdateScrapeReport).toHaveBeenCalledWith(
      expect.anything(),
      46,
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('builds a resume recovery job from pending scrape attempts when checkpoint data exists', async () => {
    mockGetPendingScrapeAttempts.mockResolvedValue([
      { cinema_id: 'C0001', date: '2026-04-23' },
      { cinema_id: 'C0001', date: '2026-04-24' },
    ]);

    const { buildRecoveryJob } = await import('../../src/index.js');

    const recoveryJob = await buildRecoveryJob({
      type: 'scrape',
      triggerType: 'manual',
      reportId: 47,
      options: { cinemaId: 'C0001' },
    });

    expect(mockGetPendingScrapeAttempts).toHaveBeenCalledWith(expect.anything(), 47);
    expect(recoveryJob).toEqual(expect.objectContaining({
      type: 'scrape',
      reportId: 47,
      options: expect.objectContaining({
        cinemaId: 'C0001',
        resumeMode: true,
        pendingAttempts: [
          { cinema_id: 'C0001', date: '2026-04-23' },
          { cinema_id: 'C0001', date: '2026-04-24' },
        ],
      }),
    }));
  });

  it('rebuilds pending attempts from partial success checkpoints to avoid replaying successful dates', async () => {
    mockGetPendingScrapeAttempts.mockResolvedValue([]);
    mockGetScrapeAttemptsByReport.mockResolvedValue([
      {
        id: 1,
        report_id: 48,
        cinema_id: 'C0001',
        date: '2026-04-23',
        status: 'success',
      },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));

    const { buildRecoveryJob } = await import('../../src/index.js');

    const recoveryJob = await buildRecoveryJob({
      type: 'scrape',
      triggerType: 'manual',
      reportId: 48,
      options: { cinemaId: 'C0001', mode: 'from_today', days: 2 },
    });

    expect(recoveryJob).toEqual(expect.objectContaining({
      options: expect.objectContaining({
        resumeMode: true,
        pendingAttempts: [{ cinema_id: 'C0001', date: '2026-04-24' }],
      }),
    }));
  });

  it('skips failed report updates when the consumer requests reconnect-aware propagation', async () => {
    const failure = new Error('redis downstream failure');
    mockRunScraper.mockRejectedValue(failure);

    const { executeJob } = await import('../../src/index.js');

    await expect(executeJob({
      type: 'scrape',
      triggerType: 'manual',
      reportId: 49,
    }, { rethrowOnFailure: true, skipReportFailureUpdate: true })).rejects.toThrow('redis downstream failure');

    expect(mockUpdateScrapeReport).toHaveBeenCalledTimes(1);
    expect(mockUpdateScrapeReport).toHaveBeenCalledWith(
      expect.anything(),
      49,
      expect.objectContaining({ status: 'running' })
    );
  });
});
