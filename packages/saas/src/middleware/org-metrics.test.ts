import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ── Mock prom-client ──────────────────────────────────────────────────────────

const { mockIncFn, mockObserveFn, MockCounter, MockHistogram, MockRegistry } = vi.hoisted(() => {
  const mockIncFn = vi.fn();
  const mockObserveFn = vi.fn();

  class MockCounter {
    inc = mockIncFn;
    constructor(public opts: Record<string, unknown>) {}
  }

  class MockHistogram {
    observe = mockObserveFn;
    startTimer = vi.fn().mockReturnValue(vi.fn());
    constructor(public opts: Record<string, unknown>) {}
  }

  class MockRegistry {
    registerMetric = vi.fn();
    metrics = vi.fn().mockResolvedValue('# metrics');
    contentType = 'text/plain';
  }

  return { mockIncFn, mockObserveFn, MockCounter, MockHistogram, MockRegistry };
});

vi.mock('prom-client', () => ({
  Counter: MockCounter,
  Histogram: MockHistogram,
  Registry: MockRegistry,
  register: new MockRegistry(),
}));

import { createOrgMetricsMiddleware, getOrgRegistry } from '../middleware/org-metrics.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

const MOCK_ORG = {
  id: 'uuid-1',
  slug: 'cinema-test',
  name: 'Cinéma Test',
  schema_name: 'org_cinema_test',
  status: 'active' as const,
  plan: 'starter',
  trial_ends_at: null,
  created_at: new Date('2026-01-01'),
};

function buildApp(): Express {
  const app = express();

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).org = MOCK_ORG;
    next();
  });

  app.use(createOrgMetricsMiddleware());

  app.get('/api/org/:slug/ping', (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createOrgMetricsMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments the HTTP request counter for each request', async () => {
    const app = buildApp();
    await request(app).get('/api/org/cinema-test/ping');

    expect(mockIncFn).toHaveBeenCalledWith(
      expect.objectContaining({ org_slug: 'cinema-test' })
    );
  });

  it('labels the counter with org_slug', async () => {
    const app = buildApp();
    await request(app).get('/api/org/cinema-test/ping');

    const callArgs = mockIncFn.mock.calls[0][0] as Record<string, string>;
    expect(callArgs.org_slug).toBe('cinema-test');
  });

  it('labels the counter with HTTP method', async () => {
    const app = buildApp();
    await request(app).get('/api/org/cinema-test/ping');

    const callArgs = mockIncFn.mock.calls[0][0] as Record<string, string>;
    expect(callArgs.method).toBe('GET');
  });

  it('labels the counter with HTTP status code', async () => {
    const app = buildApp();
    await request(app).get('/api/org/cinema-test/ping');

    const callArgs = mockIncFn.mock.calls[0][0] as Record<string, string>;
    expect(callArgs.status_code).toBeDefined();
  });

  it('works without req.org (routes not yet tenant-resolved)', async () => {
    const app = express();
    app.use(createOrgMetricsMiddleware());
    app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

    // Should not throw
    await expect(request(app).get('/health')).resolves.not.toThrow();
  });
});

describe('getOrgRegistry', () => {
  it('returns a prom-client Registry instance', () => {
    const reg = getOrgRegistry();
    expect(reg).toBeDefined();
    expect(typeof reg.metrics).toBe('function');
  });
});
