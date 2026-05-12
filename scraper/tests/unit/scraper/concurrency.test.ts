import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScraper, type ProgressPublisher } from '../../../src/scraper/index.js';
import { getTheaterConfigs } from '../../../src/db/theater-queries.js';
import { getStrategyBySource } from '../../../src/scraper/strategy-factory.js';
import { RateLimitError } from '../../../src/utils/errors.js';
import { getScrapeDates } from '../../../src/utils/date.js';

// Mock dependencies
vi.mock('../../../src/db/client.js', () => ({
  db: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock('../../../src/db/theater-queries.js', () => ({
  getTheaterConfigs: vi.fn(),
  getTheaters: vi.fn().mockResolvedValue([]),
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
    process.env.SCRAPE_THEATER_PAGE_DELAY_MS = '0';
    process.env.SCRAPE_MOVIE_DELAY_MS = '0';
  });

  it('should process theaters concurrently and respect limit', async () => {
    process.env.SCRAPER_CONCURRENCY = '2';

    const theaters = [
      { id: 'C1', name: 'Theater 1', url: 'url1', source: 'allocine' },
      { id: 'C2', name: 'Theater 2', url: 'url2', source: 'allocine' },
      { id: 'C3', name: 'Theater 3', url: 'url3', source: 'allocine' },
      { id: 'C4', name: 'Theater 4', url: 'url4', source: 'allocine' },
      { id: 'C5', name: 'Theater 5', url: 'url5', source: 'allocine' },
      { id: 'C6', name: 'Theater 6', url: 'url6', source: 'allocine' },
    ];

    (getTheaterConfigs as any).mockResolvedValue(theaters);

    let activeProcessing = 0;
    let maxConcurrent = 0;

    const mockStrategy = {
      sourceName: 'allocine',
      loadTheaterPageMetadata: vi.fn().mockImplementation(async () => {
        activeProcessing += 1;
        maxConcurrent = Math.max(maxConcurrent, activeProcessing);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeProcessing -= 1;
        return { availableDates: ['2026-04-10'], theater: { id: 'C', name: 'C' } };
      }),
      scrapeTheaterPage: vi.fn().mockResolvedValue({ filmsCount: 1, showtimesCount: 5 }),
    };

    (getStrategyBySource as any).mockReturnValue(mockStrategy);

    const startTime = Date.now();
    const summary = await runScraper(mockProgress);
    const duration = Date.now() - startTime;

    // With concurrency 2 and 50ms delay per theater metadata load:
    // the run should progress in roughly three waves rather than starting all six at once.
    expect(maxConcurrent).toBe(2);
    expect(duration).toBeGreaterThanOrEqual(140);
    expect(duration).toBeLessThan(260);
    expect(summary.successful_theaters).toBe(6);
    expect(mockProgress.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'completed' }));
  });

  it('should stop all concurrent processing on RateLimitError', async () => {
    const [currentDate] = getScrapeDates('from_today_limited', 7);
    const theaters = [
      { id: 'C1', name: 'Theater 1', url: 'url1', source: 'allocine' },
      { id: 'C2', name: 'Theater 2', url: 'url2', source: 'allocine' },
      { id: 'C3', name: 'Theater 3', url: 'url3', source: 'allocine' },
    ];

    (getTheaterConfigs as any).mockResolvedValue(theaters);

    const mockStrategy = {
      sourceName: 'allocine',
      loadTheaterPageMetadata: vi.fn().mockResolvedValue({ 
        availableDates: currentDate ? [currentDate] : [], 
        theater: { id: 'C', name: 'C' } 
      }),
      scrapeTheaterPage: vi.fn()
        .mockResolvedValueOnce({ filmsCount: 1, showtimesCount: 1 }) // C1 success
        .mockRejectedValueOnce(new RateLimitError('Rate limited', 429, 'url')) // C2 fails
        .mockResolvedValue({ filmsCount: 1, showtimesCount: 1 }), // C3 should not be called
    };

    (getStrategyBySource as any).mockReturnValue(mockStrategy);

    const summary = await runScraper(mockProgress);

    expect(summary.status).toBe('rate_limited');
    // Theater 3 might have started due to concurrency 2, but we want to see it stopped
    expect(mockStrategy.scrapeTheaterPage).toHaveBeenCalledTimes(2); 
  });
});
