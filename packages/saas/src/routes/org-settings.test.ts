import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// ── Mock server middleware that depends on module-level JWT validation ─────────
vi.mock('../../../../server/src/middleware/auth.js', () => ({
  requireAuth: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (_req as express.Request & { user?: unknown }).user = {
      id: 1,
      username: 'admin',
      role_name: 'admin',
      is_system_role: true,
      permissions: [
        'settings:read',
        'settings:update',
        'settings:reset',
        'settings:export',
        'settings:import',
      ],
    };
    next();
  }),
}));

vi.mock('../../../../server/src/middleware/permission.js', () => ({
  requirePermission: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

vi.mock('../../../../server/src/middleware/rate-limit.js', () => ({
  protectedLimiter: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

vi.mock('../../../../server/src/utils/image-validator.js', () => ({
  validateImage: vi.fn().mockResolvedValue({ valid: true, compressedBase64: 'data:image/png;base64,abc' }),
}));

// ── Mock OrgSettingsService ────────────────────────────────────────────────────
vi.mock('../services/org-settings-service.js', () => ({
  OrgSettingsService: vi.fn(),
}));

import { createOrgSettingsRouter } from '../routes/org-settings.js';
import { OrgSettingsService } from '../services/org-settings-service.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_SETTINGS = {
  id: 1,
  site_name: 'My Cinema',
  logo_base64: null,
  favicon_base64: null,
  color_primary: '#FECC00',
  color_secondary: '#1F2937',
  color_accent: '#F59E0B',
  color_background: '#FFFFFF',
  color_surface: '#F3F4F6',
  color_text_primary: '#111827',
  color_text_secondary: '#6B7280',
  color_success: '#10B981',
  color_error: '#EF4444',
  font_primary: 'Inter',
  font_secondary: 'Roboto',
  footer_text: null,
  footer_links: [],
  email_from_name: 'My Cinema',
  email_from_address: 'no-reply@mycinema.com',
  scrape_mode: 'weekly',
  scrape_days: 7,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
};

const PUBLIC_SETTINGS = {
  site_name: 'My Cinema',
  logo_base64: null,
  favicon_base64: null,
  color_primary: '#FECC00',
  color_secondary: '#1F2937',
  color_accent: '#F59E0B',
  color_background: '#FFFFFF',
  color_surface: '#F3F4F6',
  color_text_primary: '#111827',
  color_text_secondary: '#6B7280',
  color_success: '#10B981',
  color_error: '#EF4444',
  font_primary: 'Inter',
  font_secondary: 'Roboto',
  footer_text: null,
  footer_links: [],
};

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // Simulate what resolveTenant does: attach req.org and req.dbClient
  app.use((req, _res, next) => {
    req.org = { id: 'org-uuid', slug: 'my-cinema', name: 'My Cinema', status: 'active', schema_name: 'org_my_cinema' } as express.Request['org'];
    req.dbClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    } as express.Request['dbClient'];
    next();
  });

  app.use('/settings', createOrgSettingsRouter());
  return app;
}

// ── GET /settings (public) ───────────────────────────────────────────────────

describe('GET /settings (public)', () => {
  beforeEach(() => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      getPublicSettings: vi.fn().mockResolvedValue(PUBLIC_SETTINGS),
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));
  });

  it('returns 200 with public settings', async () => {
    const app = buildApp();
    const res = await request(app).get('/settings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.site_name).toBe('My Cinema');
    // sensitive fields must not be present
    expect(res.body.data.email_from_name).toBeUndefined();
  });

  it('returns 404 when no settings exist', async () => {
    vi.mocked(OrgSettingsService).mockImplementationOnce(() => ({
      getPublicSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app).get('/settings');

    expect(res.status).toBe(404);
  });
});

// ── GET /settings/admin (auth required) ──────────────────────────────────────

describe('GET /settings/admin', () => {
  beforeEach(() => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      getSettings: vi.fn().mockResolvedValue(FULL_SETTINGS),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));
  });

  it('returns 200 with full settings including email fields', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/settings/admin')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email_from_name).toBe('My Cinema');
  });

  it('returns 404 when no settings exist', async () => {
    vi.mocked(OrgSettingsService).mockImplementationOnce(() => ({
      getSettings: vi.fn().mockResolvedValue(undefined),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .get('/settings/admin')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ── PUT /settings ─────────────────────────────────────────────────────────────

describe('PUT /settings', () => {
  beforeEach(() => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      updateSettings: vi.fn().mockResolvedValue({ ...FULL_SETTINGS, site_name: 'Updated' }),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));
  });

  it('returns 200 with updated settings', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/settings')
      .set('Authorization', 'Bearer token')
      .send({ site_name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.site_name).toBe('Updated');
  });

  it('returns 400 when site_name exceeds max length', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/settings')
      .set('Authorization', 'Bearer token')
      .send({ site_name: 'A'.repeat(101) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when footer link has invalid protocol', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/settings')
      .set('Authorization', 'Bearer token')
      .send({ footer_links: [{ label: 'XSS', url: 'javascript:alert(1)' }] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when scrape_mode is invalid', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/settings')
      .set('Authorization', 'Bearer token')
      .send({ scrape_mode: 'invalid_mode' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when scrape_days is out of range', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/settings')
      .set('Authorization', 'Bearer token')
      .send({ scrape_days: 99 });

    expect(res.status).toBe(400);
  });

  it('returns 500 when update returns undefined', async () => {
    vi.mocked(OrgSettingsService).mockImplementationOnce(() => ({
      updateSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .put('/settings')
      .set('Authorization', 'Bearer token')
      .send({ site_name: 'X' });

    expect(res.status).toBe(500);
  });
});

// ── POST /settings/reset ──────────────────────────────────────────────────────

describe('POST /settings/reset', () => {
  it('returns 200 with default settings', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      resetSettings: vi.fn().mockResolvedValue(FULL_SETTINGS),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/reset')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when reset fails', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      resetSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/reset')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
  });
});

// ── POST /settings/export ─────────────────────────────────────────────────────

describe('POST /settings/export', () => {
  it('returns 200 with export data', async () => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      settings: { site_name: 'My Cinema' },
    };

    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      exportSettings: vi.fn().mockResolvedValue(exportData),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/export')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe('1.0');
  });

  it('returns 404 when nothing to export', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      exportSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      importSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/export')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ── POST /settings/import ─────────────────────────────────────────────────────

describe('POST /settings/import', () => {
  const VALID_IMPORT = {
    version: '1.0',
    exported_at: '2026-01-01T00:00:00.000Z',
    settings: {
      site_name: 'Imported Cinema',
      color_primary: '#FECC00',
    },
  };

  it('returns 200 with imported settings', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      importSettings: vi.fn().mockResolvedValue(FULL_SETTINGS),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/import')
      .set('Authorization', 'Bearer token')
      .send(VALID_IMPORT);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when import data is missing version', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      importSettings: vi.fn(),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/import')
      .set('Authorization', 'Bearer token')
      .send({ settings: {} }); // missing version

    expect(res.status).toBe(400);
  });

  it('returns 400 when importSettings throws a version error', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      importSettings: vi.fn().mockRejectedValue(new Error('Incompatible version: 2.0. Expected 1.0')),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/import')
      .set('Authorization', 'Bearer token')
      .send(VALID_IMPORT);

    expect(res.status).toBe(400);
  });

  it('returns 500 when import succeeds but returns undefined', async () => {
    vi.mocked(OrgSettingsService).mockImplementation(() => ({
      importSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn(),
      getPublicSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
    } as unknown as InstanceType<typeof OrgSettingsService>));

    const app = buildApp();
    const res = await request(app)
      .post('/settings/import')
      .set('Authorization', 'Bearer token')
      .send(VALID_IMPORT);

    expect(res.status).toBe(500);
  });
});
