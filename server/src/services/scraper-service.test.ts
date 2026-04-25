import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScraperService } from './scraper-service.js';
import * as reportQueries from '../db/report-queries.js';
import * as cinemaQueries from '../db/cinema-queries.js';
import * as redisClient from './redis-client.js';
import { type DB } from '../db/client.js';

vi.mock('../db/report-queries.js');
vi.mock('../db/cinema-queries.js');
vi.mock('./redis-client.js');
vi.mock('./progress-tracker.js', () => ({
  progressTracker: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    getListenerCount: vi.fn().mockReturnValue(1),
  },
}));
import { progressTracker } from './progress-tracker.js';

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
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'scrape',
        reportId: 42,
        options: { cinemaId: 'C1', filmId: 123 }
      }));
    });

    it('should mark the report failed when queue publish exhausts retry attempts', async () => {
      const publishError = new Error('redis enqueue failed');
      const mockPublish = vi.fn().mockRejectedValue(publishError);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(48 as any);

      await expect(scraperService.triggerScrape({})).rejects.toThrow('redis enqueue failed');

      expect(reportQueries.updateScrapeReport).toHaveBeenCalledWith(
        mockDb,
        48,
        expect.objectContaining({
          status: 'failed',
          errors: [{ cinema_name: 'System', error: 'redis enqueue failed' }],
        })
      );
    });

    it('should attach org observability context to queued job metadata', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(45 as any);
      vi.mocked(cinemaQueries.getCinemas).mockResolvedValue([{ id: 'C1' }] as any);

      await scraperService.triggerScrape(
        { cinemaId: 'C1' },
        {
          endpoint: '/api/org/acme/scraper/trigger',
          method: 'POST',
          user: {
            id: 101,
            username: 'tenant-admin',
            role_name: 'admin',
            is_system_role: false,
            permissions: [],
            org_id: 77,
            org_slug: 'acme',
          },
        }
      );

      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        traceContext: expect.objectContaining({
          org_id: '77',
          org_slug: 'acme',
          user_id: '101',
          endpoint: '/api/org/acme/scraper/trigger',
          method: 'POST',
        }),
      }));
    });

    it('should include traceparent in trace context when provided', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(47 as any);

      await scraperService.triggerScrape(
        {},
        {
          endpoint: '/api/scraper/trigger',
          method: 'POST',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          user: {
            id: 1,
            username: 'admin',
            role_name: 'admin',
            is_system_role: true,
            permissions: [],
          },
        }
      );

      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        traceContext: expect.objectContaining({
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        }),
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

  describe('triggerResume', () => {
    it('should trigger resume scrape successfully with pending attempts', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(43 as any);

      const pendingAttempts = [
        { cinema_id: 'C0042', date: '2026-03-26' },
        { cinema_id: 'C0089', date: '2026-03-25' },
      ] as any;

      const result = await scraperService.triggerResume(123, pendingAttempts);

      expect(result.reportId).toBe(43);
      expect(reportQueries.createScrapeReport).toHaveBeenCalledWith(mockDb, 'manual', 123);
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'scrape',
        reportId: 43,
        triggerType: 'manual',
        options: {
          resumeMode: true,
          pendingAttempts: [
            { cinema_id: 'C0042', date: '2026-03-26' },
            { cinema_id: 'C0089', date: '2026-03-25' },
          ],
        },
      }));
    });

    it('should handle empty pending attempts list', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(44 as any);

      const result = await scraperService.triggerResume(123, []);

      expect(result.reportId).toBe(44);
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        options: {
          resumeMode: true,
          pendingAttempts: [],
        },
      }));
    });

    it('should mark the resume report failed when queue publish exhausts retry attempts', async () => {
      const publishError = new Error('redis enqueue failed');
      const mockPublish = vi.fn().mockRejectedValue(publishError);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(49 as any);

      await expect(scraperService.triggerResume(123, [])).rejects.toThrow('redis enqueue failed');

      expect(reportQueries.updateScrapeReport).toHaveBeenCalledWith(
        mockDb,
        49,
        expect.objectContaining({
          status: 'failed',
          errors: [{ cinema_name: 'System', error: 'redis enqueue failed' }],
        })
      );
    });

    it('should attach org observability context on resume jobs', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(46 as any);

      await scraperService.triggerResume(
        123,
        [{ cinema_id: 'C0042', date: '2026-03-26' }] as any,
        {
          endpoint: '/api/org/acme/scraper/resume/123',
          method: 'POST',
          user: {
            id: 9,
            username: 'org-user',
            role_name: 'admin',
            is_system_role: false,
            permissions: [],
            org_id: 88,
            org_slug: 'acme',
          },
        }
      );

      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
        traceContext: expect.objectContaining({
          org_id: '88',
          org_slug: 'acme',
          user_id: '9',
          endpoint: '/api/org/acme/scraper/resume/123',
          method: 'POST',
        }),
      }));
    });
  });

  describe('subscribeToProgress', () => {
    it('should add listener and return cleanup function', () => {
      const mockRes = { setHeader: vi.fn() };
      const mockOnClose = vi.fn();
      
      const cleanup = scraperService.subscribeToProgress(mockRes, mockOnClose);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(progressTracker.addListener).toHaveBeenCalledWith(mockRes, undefined);
      
      cleanup();
      
      expect(progressTracker.removeListener).toHaveBeenCalledWith(mockRes);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should pass tenant trace context to progress tracker', () => {
      const mockRes = { setHeader: vi.fn() };
      const mockOnClose = vi.fn();

      scraperService.subscribeToProgress(mockRes, mockOnClose, {
        endpoint: '/api/org/acme/scraper/progress',
        method: 'GET',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        user: {
          id: 3,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      });

      expect(progressTracker.addListener).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          org_id: '42',
          org_slug: 'acme',
          user_id: '3',
          endpoint: '/api/org/acme/scraper/progress',
          method: 'GET',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        })
      );
    });
  });
});
