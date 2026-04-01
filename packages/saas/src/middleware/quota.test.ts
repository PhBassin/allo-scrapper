import { describe, it, expect, vi } from 'vitest';
import express, { type Express } from 'express';
import supertest from 'supertest';
import { checkQuota } from '../middleware/quota.js';
import type { DB } from '../db/types.js';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../services/quota-service.js', () => ({
  QuotaService: vi.fn(),
}));

vi.mock('../db/org-queries.js', () => ({
  getPlanById: vi.fn(),
}));

// Import mocked modules at the top level (works because vi.mock is hoisted)
import { QuotaService } from '../services/quota-service.js';
import { getPlanById } from '../db/org-queries.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDb(): DB {
  return { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

const STARTER_PLAN = {
  id: 2,
  name: 'Starter',
  max_cinemas: 5,
  max_users: 3,
  max_scrapes_per_month: 20,
  scrape_frequency_min: 2880,
  price_monthly_cents: 1900,
  price_yearly_cents: 18000,
  features: {},
};

const FREE_PLAN = {
  id: 1,
  name: 'Free',
  max_cinemas: 1,
  max_users: 1,
  max_scrapes_per_month: 4,
  scrape_frequency_min: 10080,
  price_monthly_cents: 0,
  price_yearly_cents: 0,
  features: {},
};

const MOCK_ORG = {
  id: 'org-uuid-1',
  slug: 'my-cinema',
  schema_name: 'org_my_cinema',
  plan_id: 2,
  status: 'active',
};

function buildApp(resource: 'cinemas' | 'users' | 'scrapes', db: DB): Express {
  const app = express();
  app.use(express.json());
  app.set('db', db);
  app.use((req: any, _res: any, next: any) => {
    req.org = MOCK_ORG;
    next();
  });
  app.post('/test', checkQuota(resource), (_req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
}

/** Helper: set up QuotaService mock to return specific usage counts. */
function mockUsage(counts: { cinemas_count?: number; users_count?: number; scrapes_count?: number }) {
  vi.mocked(QuotaService).mockImplementation(() => ({
    getOrCreateUsage: vi.fn().mockResolvedValue({
      cinemas_count: counts.cinemas_count ?? 0,
      users_count:   counts.users_count   ?? 0,
      scrapes_count: counts.scrapes_count ?? 0,
      api_calls_count: 0,
    }),
    incrementUsage: vi.fn(),
    decrementUsage: vi.fn(),
    resetMonthlyUsage: vi.fn(),
  }) as any);
}

// ── checkQuota ────────────────────────────────────────────────────────────────

describe('checkQuota middleware', () => {
  describe('cinemas quota', () => {
    it('calls next() when usage is below the plan limit', async () => {
      vi.mocked(getPlanById).mockResolvedValue(STARTER_PLAN as any);
      mockUsage({ cinemas_count: 3 });

      const app = buildApp('cinemas', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 402 QUOTA_EXCEEDED when usage is at the plan limit', async () => {
      vi.mocked(getPlanById).mockResolvedValue(STARTER_PLAN as any);
      mockUsage({ cinemas_count: 5 }); // at limit

      const app = buildApp('cinemas', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(402);
      expect(res.body.error).toBe('QUOTA_EXCEEDED');
      expect(res.body.resource).toBe('cinemas');
      expect(res.body.limit).toBe(5);
    });

    it('calls next() when plan limit is null (unlimited)', async () => {
      vi.mocked(getPlanById).mockResolvedValue({ ...STARTER_PLAN, max_cinemas: null } as any);
      mockUsage({ cinemas_count: 9999 });

      const app = buildApp('cinemas', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(200);
    });
  });

  describe('users quota', () => {
    it('returns 402 when users_count is at the plan limit', async () => {
      vi.mocked(getPlanById).mockResolvedValue(FREE_PLAN as any); // max_users: 1
      mockUsage({ users_count: 1 }); // at limit

      const app = buildApp('users', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(402);
      expect(res.body.error).toBe('QUOTA_EXCEEDED');
      expect(res.body.resource).toBe('users');
    });

    it('calls next() when users are below the limit', async () => {
      vi.mocked(getPlanById).mockResolvedValue(STARTER_PLAN as any); // max_users: 3
      mockUsage({ users_count: 1 });

      const app = buildApp('users', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(200);
    });
  });

  describe('scrapes quota', () => {
    it('returns 402 when scrapes_count is at the plan limit', async () => {
      vi.mocked(getPlanById).mockResolvedValue(FREE_PLAN as any); // max_scrapes_per_month: 4
      mockUsage({ scrapes_count: 4 }); // at limit

      const app = buildApp('scrapes', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(402);
      expect(res.body.error).toBe('QUOTA_EXCEEDED');
      expect(res.body.resource).toBe('scrapes');
    });

    it('calls next() when scrapes are below the monthly limit', async () => {
      vi.mocked(getPlanById).mockResolvedValue(FREE_PLAN as any); // max_scrapes_per_month: 4
      mockUsage({ scrapes_count: 2 });

      const app = buildApp('scrapes', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('returns 500 when plan cannot be loaded', async () => {
      vi.mocked(getPlanById).mockResolvedValue(null);
      mockUsage({});

      const app = buildApp('cinemas', makeDb());
      const res = await supertest(app).post('/test');

      expect(res.status).toBe(500);
    });
  });
});
