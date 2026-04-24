import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScraper, type ProgressPublisher } from '../../../src/scraper/index.js';
import { getCinemaConfigs } from '../../../src/db/cinema-queries.js';
import { getStrategyBySource } from '../../../src/scraper/strategy-factory.js';
import { RateLimitError } from '../../../src/utils/errors.js';
import { getScrapeDates } from '../../../src/utils/date.js';

// Mock dependencies
vi.mock('../../../src/db/client.js', () => ({
  db: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock('../../../src/db/cinema-queries.js', () => ({
  getCinemaConfigs: vi.fn(),
  getCinemas: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/scraper/strategy-factory.js', () => ({
  getStrategyBySource: vi.fn(),
}));

vi.mock('../../../src/scraper/http-client.js', () => ({
  closeBrowser: vi.fn().mockResolvedValue(undefined),
  delay: vi.fn().mockResolvedValue(undefined),
  circuitBreaker: {
    getState: vi.fn().mockReturnValue('closed'),
  },
}));

describe('runScraper concurrency', () => {
  const mockDb = { query: vi.fn() };
  const mockProgress: ProgressPublisher = {
    emit: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCRAPER_CONCURRENCY = '2';
    process.env.SCRAPE_THEATER_DELAY_MS = '0';
    process.env.SCRAPE_MOVIE_DELAY_MS = '0';
  });

  it('should process cinemas concurrently and respect limit', async () => {
    process.env.SCRAPER_CONCURRENCY = '2';

    const cinemas = [
      { id: 'C1', name: 'Cinema 1', url: 'url1', source: 'allocine' },
      { id: 'C2', name: 'Cinema 2', url: 'url2', source: 'allocine' },
      { id: 'C3', name: 'Cinema 3', url: 'url3', source: 'allocine' },
      { id: 'C4', name: 'Cinema 4', url: 'url4', source: 'allocine' },
      { id: 'C5', name: 'Cinema 5', url: 'url5', source: 'allocine' },
      { id: 'C6', name: 'Cinema 6', url: 'url6', source: 'allocine' },
    ];

    (getCinemaConfigs as any).mockResolvedValue(cinemas);

    let activeProcessing = 0;
    let maxConcurrent = 0;

    const mockStrategy = {
      sourceName: 'allocine',
      loadTheaterMetadata: vi.fn().mockImplementation(async () => {
        activeProcessing += 1;
        maxConcurrent = Math.max(maxConcurrent, activeProcessing);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeProcessing -= 1;
        return { availableDates: ['2026-04-10'], cinema: { id: 'C', name: 'C' } };
      }),
      scrapeTheater: vi.fn().mockResolvedValue({ filmsCount: 1, showtimesCount: 5 }),
    };

    (getStrategyBySource as any).mockReturnValue(mockStrategy);

    const startTime = Date.now();
    const summary = await runScraper(mockProgress);
    const duration = Date.now() - startTime;

    // With concurrency 2 and 50ms delay per cinema metadata load:
    // the run should progress in roughly three waves rather than starting all six at once.
    expect(maxConcurrent).toBe(2);
    expect(duration).toBeGreaterThanOrEqual(140);
    expect(duration).toBeLessThan(260);
    expect(summary.successful_cinemas).toBe(6);
    expect(mockProgress.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'completed' }));
  });

  it('should stop all concurrent processing on RateLimitError', async () => {
    const [currentDate] = getScrapeDates('from_today_limited', 7);
    const cinemas = [
      { id: 'C1', name: 'Cinema 1', url: 'url1', source: 'allocine' },
      { id: 'C2', name: 'Cinema 2', url: 'url2', source: 'allocine' },
      { id: 'C3', name: 'Cinema 3', url: 'url3', source: 'allocine' },
    ];

    (getCinemaConfigs as any).mockResolvedValue(cinemas);

    const mockStrategy = {
      sourceName: 'allocine',
      loadTheaterMetadata: vi.fn().mockResolvedValue({ 
        availableDates: currentDate ? [currentDate] : [], 
        cinema: { id: 'C', name: 'C' } 
      }),
      scrapeTheater: vi.fn()
        .mockResolvedValueOnce({ filmsCount: 1, showtimesCount: 1 }) // C1 success
        .mockRejectedValueOnce(new RateLimitError('Rate limited', 429, 'url')) // C2 fails
        .mockResolvedValue({ filmsCount: 1, showtimesCount: 1 }), // C3 should not be called
    };

    (getStrategyBySource as any).mockReturnValue(mockStrategy);

    const summary = await runScraper(mockProgress);

    expect(summary.status).toBe('rate_limited');
    // Cinema 3 might have started due to concurrency 2, but we want to see it stopped
    expect(mockStrategy.scrapeTheater).toHaveBeenCalledTimes(2); 
  });
});
