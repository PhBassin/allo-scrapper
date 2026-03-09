import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the scraper route.
 * Redis is now the only mode — USE_REDIS_SCRAPER feature flag has been removed.
 * All scraping is delegated to the scraper microservice via Redis.
 */

// ---- mocks ----------------------------------------------------------------

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((req, res, next) => next())
}));

vi.mock('../services/progress-tracker.js', () => ({
  progressTracker: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    getListenerCount: vi.fn().mockReturnValue(0),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/redis-client.js', () => ({
  getRedisClient: vi.fn().mockReturnValue({
    publishJob: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock('../db/client.js', () => ({
  db: {},
}));

vi.mock('../db/queries.js', () => ({
  createScrapeReport: vi.fn().mockResolvedValue(99),
  updateScrapeReport: vi.fn(),
  getLatestScrapeReport: vi.fn().mockResolvedValue(null),
  getCinemas: vi.fn().mockResolvedValue([
    { id: 'C0153', name: 'Cinéma Chaplin Denfert' },
    { id: 'W7515', name: 'Cinéma Chaplin Saint Lambert' },
    { id: 'C0076', name: 'Cinéma du Panthéon' },
  ]),
}));

// ---- helpers ---------------------------------------------------------------

import { db } from '../db/client.js';

let mockApp: any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockApp = {
    get: vi.fn((key: string) => {
      if (key === 'db') return db;
      return undefined;
    })
  };
});

function buildMockRes() {
  const res: any = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    on: vi.fn(),
  };
  return res;
}

function buildMockReq(overrides: object = {}) {
  return { on: vi.fn(), app: mockApp, ...overrides } as any;
}

// Helper to get the last handler in the route stack (actual route handler, after middleware)
function getRouteHandler(layer: any) {
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

// ---- tests -----------------------------------------------------------------

describe('Routes - Scraper (Redis mode — only mode)', () => {
  it('POST /trigger queues a job via Redis and returns reportId + queueDepth', async () => {
    const { default: router } = await import('./scraper.js');
    const { getRedisClient } = await import('../services/redis-client.js');
    const { createScrapeReport } = await import('../db/queries.js');

    (createScrapeReport as any).mockResolvedValue(99);
    (getRedisClient as any).mockReturnValue({
      publishJob: vi.fn().mockResolvedValue(1),
    });

    const req = buildMockReq({ body: {} });
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await getRouteHandler(layer)(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          reportId: 99,
          queueDepth: 1,
        }),
      })
    );
  }, 10000);

  it('GET /status returns isRunning=false and latestReport', async () => {
    const { default: router } = await import('./scraper.js');
    const { getLatestScrapeReport } = await import('../db/queries.js');

    (getLatestScrapeReport as any).mockResolvedValue(null);

    const req = buildMockReq();
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/status' && l.route?.methods?.get
    );
    await getRouteHandler(layer)(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          isRunning: false,
          latestReport: null,
        }),
      })
    );
  });

  it('POST /trigger with cinemaId queues cinema scrape job via Redis', async () => {
    const { default: router } = await import('./scraper.js');
    const { getRedisClient } = await import('../services/redis-client.js');
    const { createScrapeReport } = await import('../db/queries.js');

    (createScrapeReport as any).mockResolvedValue(99);
    const mockPublishJob = vi.fn().mockResolvedValue(1);
    (getRedisClient as any).mockReturnValue({
      publishJob: mockPublishJob,
    });

    const req = buildMockReq({ body: { cinemaId: 'C0153' } });
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await getRouteHandler(layer)(req, res, vi.fn());

    expect(mockPublishJob).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 99,
        triggerType: 'manual',
        options: expect.objectContaining({
          cinemaId: 'C0153',
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          reportId: 99,
          queueDepth: 1,
        }),
      })
    );
  });

  it('POST /trigger with W-prefix cinemaId queues cinema scrape job via Redis', async () => {
    const { default: router } = await import('./scraper.js');
    const { getRedisClient } = await import('../services/redis-client.js');
    const { createScrapeReport } = await import('../db/queries.js');

    (createScrapeReport as any).mockResolvedValue(99);
    const mockPublishJob = vi.fn().mockResolvedValue(1);
    (getRedisClient as any).mockReturnValue({
      publishJob: mockPublishJob,
    });

    const req = buildMockReq({ body: { cinemaId: 'W7515' } });
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await getRouteHandler(layer)(req, res, vi.fn());

    expect(mockPublishJob).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 99,
        triggerType: 'manual',
        options: expect.objectContaining({
          cinemaId: 'W7515',
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          reportId: 99,
          queueDepth: 1,
        }),
      })
    );
  });

  it('POST /trigger rejects non-existent cinemaId', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq({ body: { cinemaId: 'CXXXX' } });
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await getRouteHandler(layer)(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Cinema not found'),
      })
    );
  });

  it('POST /trigger with both cinemaId and filmId queues job via Redis', async () => {
    const { default: router } = await import('./scraper.js');
    const { getRedisClient } = await import('../services/redis-client.js');
    const { createScrapeReport } = await import('../db/queries.js');

    (createScrapeReport as any).mockResolvedValue(99);
    const mockPublishJob = vi.fn().mockResolvedValue(1);
    (getRedisClient as any).mockReturnValue({
      publishJob: mockPublishJob,
    });

    const req = buildMockReq({ body: { cinemaId: 'C0153', filmId: 12345 } });
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await getRouteHandler(layer)(req, res, vi.fn());

    expect(mockPublishJob).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 99,
        triggerType: 'manual',
        options: expect.objectContaining({
          cinemaId: 'C0153',
          filmId: 12345,
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ reportId: 99, queueDepth: 1 }),
      })
    );
  });
});
