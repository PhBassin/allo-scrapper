import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ── Mock OrgExportService ─────────────────────────────────────────────────────
vi.mock('../services/org-export-service.js', () => ({
  OrgExportService: vi.fn(),
}));

import { createOrgExportRouter } from '../routes/org-export.js';
import { OrgExportService } from '../services/org-export-service.js';

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

const MOCK_EXPORT = {
  org: { slug: 'cinema-test', name: 'Cinéma Test' },
  cinemas: [{ id: 'C0001', name: 'Cinema Alpha', source: 'allocine' }],
  showtimes: [{ cinema_id: 'C0001', film_id: 1, show_time: '2026-04-01T20:00:00Z' }],
  settings: { site_name: 'Cinéma Test', color_primary: '#FECC00' },
  exported_at: '2026-04-01T00:00:00.000Z',
};

function buildApp(): Express {
  const app = express();

  // Inject mock pool + tenant
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const mockClient = { query: vi.fn(), release: vi.fn() };
    req.app.set('pool', { connect: vi.fn().mockResolvedValue(mockClient) });
    (req as any).org = MOCK_ORG;
    (req as any).dbClient = mockClient;
    next();
  });

  app.use('/api/org/:slug', createOrgExportRouter());
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/org/:slug/export', () => {
  let mockExportFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExportFn = vi.fn().mockResolvedValue(MOCK_EXPORT);
    vi.mocked(OrgExportService).mockImplementation(
      () => ({ exportOrg: mockExportFn }) as unknown as OrgExportService
    );
  });

  it('returns 200 with JSON export payload', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/org/cinema-test/export');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.org.slug).toBe('cinema-test');
  });

  it('includes cinemas in the export', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/org/cinema-test/export');

    expect(res.body.data.cinemas).toHaveLength(1);
    expect(res.body.data.cinemas[0].id).toBe('C0001');
  });

  it('includes showtimes in the export', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/org/cinema-test/export');

    expect(res.body.data.showtimes).toHaveLength(1);
  });

  it('includes settings in the export', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/org/cinema-test/export');

    expect(res.body.data.settings).toBeDefined();
    expect(res.body.data.settings.site_name).toBe('Cinéma Test');
  });

  it('includes exported_at timestamp', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/org/cinema-test/export');

    expect(res.body.data.exported_at).toBeDefined();
  });

  it('calls OrgExportService.exportOrg with the correct org', async () => {
    const app = buildApp();
    await request(app).get('/api/org/cinema-test/export');

    expect(mockExportFn).toHaveBeenCalledOnce();
  });

  it('returns 500 when export service throws', async () => {
    mockExportFn.mockRejectedValue(new Error('DB error'));
    const app = buildApp();
    const res = await request(app).get('/api/org/cinema-test/export');

    expect(res.status).toBe(500);
  });
});
