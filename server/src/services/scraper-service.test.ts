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
    hasListener: vi.fn().mockReturnValue(true),
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
    ScraperService.resetProgressConnectionTrackingForTests();
    vi.mocked(progressTracker.hasListener).mockReturnValue(true);
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
      expect(progressTracker.addListener).toHaveBeenCalledWith(mockRes, undefined, undefined);
      
      cleanup();
      
      expect(progressTracker.removeListener).toHaveBeenCalledWith(mockRes);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reject a fourth concurrent progress connection for the same user', () => {
      const context = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      };

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context)).toThrow(
        'Maximum of 3 concurrent progress connections per user exceeded'
      );

      cleanup1();
      cleanup2();
      cleanup3();
    });

    it('should scope concurrent progress connections by org slug and user id', () => {
      const acmeContext = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      };
      const bravoContext = {
        user: {
          ...acmeContext.user,
          org_id: 77,
          org_slug: 'bravo',
        },
      };

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), acmeContext);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), acmeContext);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), acmeContext);

      const otherTenantCleanup = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), bravoContext);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), acmeContext)).toThrow(
        'Maximum of 3 concurrent progress connections per user exceeded'
      );

      cleanup1();
      cleanup2();
      cleanup3();
      otherTenantCleanup();
    });

    it('should fall back to org id in the connection key when org slug is absent', () => {
      const firstOrgContext = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
        },
      };
      const secondOrgContext = {
        user: {
          ...firstOrgContext.user,
          org_id: 77,
        },
      };

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), firstOrgContext);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), firstOrgContext);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), firstOrgContext);

      const otherTenantCleanup = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), secondOrgContext);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), firstOrgContext)).toThrow(
        'Maximum of 3 concurrent progress connections per user exceeded'
      );

      cleanup1();
      cleanup2();
      cleanup3();
      otherTenantCleanup();
    });

    it('should use distinct namespaces for org slug, org id fallback, and system scope in the connection key', () => {
      const slugContext = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: '42',
        },
      };
      const orgIdFallbackContext = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
        },
      };
      const systemContext = {
        user: {
          id: 7,
          username: 'system-user',
          role_name: 'superadmin',
          is_system_role: true,
          permissions: [],
        },
      };

      const cleanupSlug1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), slugContext);
      const cleanupSlug2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), slugContext);
      const cleanupSlug3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), slugContext);

      const cleanupOrgFallback = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), orgIdFallbackContext);
      const cleanupSystem = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), systemContext);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), slugContext)).toThrow(
        'Maximum of 3 concurrent progress connections per user exceeded'
      );

      cleanupSlug1();
      cleanupSlug2();
      cleanupSlug3();
      cleanupOrgFallback();
      cleanupSystem();
    });

    it('should allow a new connection after disconnect cleanup releases the slot', () => {
      const context = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      };

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      cleanup2();

      const cleanup4 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      cleanup1();
      cleanup3();
      cleanup4();
    });

    it('should release the reserved slot when tracker subscription fails', () => {
      const context = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      };

      vi.mocked(progressTracker.addListener)
        .mockImplementationOnce(() => {
          throw new Error('tracker failed');
        })
        .mockImplementation(() => undefined);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context)).toThrow('tracker failed');

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      cleanup1();
      cleanup2();
      cleanup3();
    });

    it('should release the reserved slot when setting SSE headers fails before tracker subscription', () => {
      const context = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      };
      const setHeader = vi.fn()
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new Error('headers already sent');
        });

      expect(() => scraperService.subscribeToProgress({ setHeader }, vi.fn(), context)).toThrow('headers already sent');

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context)).toThrow(
        'Maximum of 3 concurrent progress connections per user exceeded'
      );

      cleanup1();
      cleanup2();
      cleanup3();
    });

    it('should release the reserved slot when the listener dies during initial replay', () => {
      const context = {
        user: {
          id: 7,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      };

      vi.mocked(progressTracker.addListener).mockImplementationOnce(() => undefined);
      vi.mocked(progressTracker.hasListener)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      const cleanupAfterReplayFailure = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      const cleanup1 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup2 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);
      const cleanup3 = scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context);

      expect(() => scraperService.subscribeToProgress({ setHeader: vi.fn() }, vi.fn(), context)).toThrow(
        'Maximum of 3 concurrent progress connections per user exceeded'
      );

      cleanupAfterReplayFailure();
      cleanup1();
      cleanup2();
      cleanup3();
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
        }),
        undefined
      );
    });

    it('should pass Last-Event-ID resume context to progress tracker', () => {
      const mockRes = { setHeader: vi.fn() };
      const mockOnClose = vi.fn();

      scraperService.subscribeToProgress(mockRes, mockOnClose, {
        endpoint: '/api/org/acme/scraper/progress',
        method: 'GET',
        user: {
          id: 3,
          username: 'tenant-user',
          role_name: 'admin',
          is_system_role: false,
          permissions: [],
          org_id: 42,
          org_slug: 'acme',
        },
      }, '17');

      expect(progressTracker.addListener).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          org_id: '42',
          org_slug: 'acme',
          user_id: '3',
        }),
        '17'
      );
    });
  });
});
