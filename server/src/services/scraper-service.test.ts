import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScraperService } from './scraper-service.js';
import * as reportQueries from '../db/report-queries.js';
import * as cinemaQueries from '../db/cinema-queries.js';
import * as redisClient from './redis-client.js';
import { progressTracker } from './progress-tracker.js';
import { type DB } from '../db/client.js';

vi.mock('../db/report-queries.js');
vi.mock('../db/cinema-queries.js');
vi.mock('./redis-client.js');
vi.mock('./progress-tracker.js', () => ({
  progressTracker: {
    reset: vi.fn(),
    clearEvents: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    getListenerCount: vi.fn().mockReturnValue(1),
  },
}));

describe('ScraperService', () => {
  let scraperService: ScraperService;
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    scraperService = new ScraperService(mockDb);
  });

  describe('triggerScrape', () => {
    it('should throw error if cinemaId provided but not found', async () => {
      vi.mocked(cinemaQueries.getCinemas).mockResolvedValue([{ id: 'C1' }] as any);
      await expect(scraperService.triggerScrape({ cinemaId: 'UNKNOWN' })).rejects.toThrow('Cinema not found');
    });

    it('should trigger scrape successfully', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(42 as any);
      vi.mocked(cinemaQueries.getCinemas).mockResolvedValue([{ id: 'C1' }] as any);

      const result = await scraperService.triggerScrape({ cinemaId: 'C1', filmId: 123 });

      expect(result.reportId).toBe(42);
      expect(progressTracker.clearEvents).toHaveBeenCalled();
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'scrape',
        reportId: 42,
        options: { cinemaId: 'C1', filmId: 123 }
      }));
    });
  });

  describe('getStatus', () => {
    it('should return status from latest report', async () => {
      vi.mocked(reportQueries.getLatestScrapeReport).mockResolvedValue({ id: 1, status: 'running' } as any);
      const result = await scraperService.getStatus();
      expect(result.isRunning).toBe(true);
      expect(result.latestReport?.id).toBe(1);
    });

    it('should return isRunning=false if no report', async () => {
      vi.mocked(reportQueries.getLatestScrapeReport).mockResolvedValue(undefined);
      const result = await scraperService.getStatus();
      expect(result.isRunning).toBe(false);
      expect(result.latestReport).toBeUndefined();
    });
  });

  describe('subscribeToProgress', () => {
    it('should add listener and return cleanup function', () => {
      const mockRes = { setHeader: vi.fn() };
      const mockOnClose = vi.fn();
      
      const cleanup = scraperService.subscribeToProgress(mockRes, mockOnClose);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(progressTracker.addListener).toHaveBeenCalledWith(mockRes);
      
      cleanup();
      
      expect(progressTracker.removeListener).toHaveBeenCalledWith(mockRes);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
