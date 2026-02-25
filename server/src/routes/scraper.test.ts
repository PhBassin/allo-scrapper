import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the scraper route, specifically the USE_REDIS_SCRAPER feature flag.
 *
 * E2E Note: The Playwright E2E tests in e2e/scrape-progress.spec.ts run against
 * the legacy in-process mode (USE_REDIS_SCRAPER=false, the default). The SSE
 * /api/scraper/progress endpoint and the UI contract are identical in both modes
 * so no separate E2E suite is required for the Redis path.
 */

// ---- mocks ----------------------------------------------------------------

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((req, res, next) => next())
}));

vi.mock('../services/scrape-manager.js', () => ({
  scrapeManager: {
    isRunning: vi.fn().mockReturnValue(false),
    getCurrentSession: vi.fn().mockReturnValue(null),
    startScrape: vi.fn().mockResolvedValue(42),
    getLatestReport: vi.fn().mockResolvedValue(null),
  },
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

// Lazy mocks for Redis-mode imports (only exercised when USE_REDIS_SCRAPER=true)
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

import { scrapeManager } from '../services/scrape-manager.js';

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
  return { on: vi.fn(), ...overrides } as any;
}

// ---- tests -----------------------------------------------------------------

describe('Routes - Scraper (USE_REDIS_SCRAPER=false / legacy mode)', () => {
  beforeEach(() => {
    delete process.env.USE_REDIS_SCRAPER;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('POST /trigger starts a scrape and returns reportId', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq({ body: {} });
    const res = buildMockRes();

    (scrapeManager.isRunning as any).mockReturnValue(false);
    (scrapeManager.startScrape as any).mockResolvedValue(42);

    // Invoke the POST /trigger handler directly via the router's stack
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();
    await layer.route.stack[1].handle(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ reportId: 42 }),
      })
    );
  }, 10000); // Increase timeout to 10s for first test with module import overhead

  it('POST /trigger returns 409 when scrape already running', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq({ body: {} });
    const res = buildMockRes();

    (scrapeManager.isRunning as any).mockReturnValue(true);
    (scrapeManager.getCurrentSession as any).mockReturnValue({
      startedAt: new Date('2026-01-01'),
      triggerType: 'manual',
    });

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await layer.route.stack[1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('GET /status includes useRedisScraper=false and isRunning', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq();
    const res = buildMockRes();

    (scrapeManager.isRunning as any).mockReturnValue(false);
    (scrapeManager.getLatestReport as any).mockResolvedValue(null);

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/status' && l.route?.methods?.get
    );
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          isRunning: false,
          useRedisScraper: false,
        }),
      })
    );
  });

  it('POST /trigger with cinemaId starts cinema-only scrape', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq({ body: { cinemaId: 'C0153' } });
    const res = buildMockRes();

    (scrapeManager.isRunning as any).mockReturnValue(false);
    (scrapeManager.startScrape as any).mockResolvedValue(42);

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await layer.route.stack[1].handle(req, res, vi.fn());

    expect(scrapeManager.startScrape).toHaveBeenCalledWith(
      'manual',
      expect.objectContaining({
        cinemaId: 'C0153',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ reportId: 42 }),
      })
    );
  });

  it('POST /trigger accepts cinemaId with W prefix (W7515)', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq({ body: { cinemaId: 'W7515' } });
    const res = buildMockRes();

    (scrapeManager.isRunning as any).mockReturnValue(false);
    (scrapeManager.startScrape as any).mockResolvedValue(42);

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await layer.route.stack[1].handle(req, res, vi.fn());

    expect(scrapeManager.startScrape).toHaveBeenCalledWith(
      'manual',
      expect.objectContaining({
        cinemaId: 'W7515',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ reportId: 42 }),
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
    await layer.route.stack[1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Cinema not found'),
      })
    );
  });

  it('POST /trigger with both cinemaId and filmId works', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq({ body: { cinemaId: 'C0153', filmId: 12345 } });
    const res = buildMockRes();

    (scrapeManager.isRunning as any).mockReturnValue(false);
    (scrapeManager.startScrape as any).mockResolvedValue(42);

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/trigger' && l.route?.methods?.post
    );
    await layer.route.stack[1].handle(req, res, vi.fn());

    expect(scrapeManager.startScrape).toHaveBeenCalledWith(
      'manual',
      expect.objectContaining({
        cinemaId: 'C0153',
        filmId: 12345,
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ reportId: 42 }),
      })
    );
  });
});

describe('Routes - Scraper (USE_REDIS_SCRAPER=true / Redis mode)', () => {
  beforeEach(() => {
    process.env.USE_REDIS_SCRAPER = 'true';
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.USE_REDIS_SCRAPER;
  });

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
    await layer.route.stack[1].handle(req, res, vi.fn());

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

  it('GET /status returns useRedisScraper=true and isRunning=false', async () => {
    const { default: router } = await import('./scraper.js');

    const req = buildMockReq();
    const res = buildMockRes();

    const layer = router.stack.find(
      (l: any) => l.route?.path === '/status' && l.route?.methods?.get
    );
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          useRedisScraper: true,
          isRunning: false,
          currentSession: null,
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
    await layer.route.stack[1].handle(req, res, vi.fn());

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
    await layer.route.stack[1].handle(req, res, vi.fn());

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
});
