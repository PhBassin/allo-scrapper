import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from 'allo-scrapper-server/dist/middleware/error-handler.js';
import { validateImage } from 'allo-scrapper-server/dist/utils/image-validator.js';

const updateSettingsMock = vi.fn();
const getSettingsMock = vi.fn();

vi.mock('../services/org-settings-service.js', () => ({
  OrgSettingsService: vi.fn(function MockOrgSettingsService() {
    return {
      updateSettings: updateSettingsMock,
      getSettings: getSettingsMock,
    };
  }),
}));

vi.mock('allo-scrapper-server/dist/utils/image-validator.js', () => ({
  validateImage: vi.fn(),
}));

vi.mock('allo-scrapper-server/dist/middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, username: 'admin' };
      return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
  },
}));

vi.mock('allo-scrapper-server/dist/middleware/permission.js', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

describe('POST /api/org/:slug/settings/import', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    updateSettingsMock.mockResolvedValue({ id: 1, site_name: 'Updated Org' });
    getSettingsMock.mockResolvedValue({
      id: 1,
      site_name: 'Updated Org',
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
      footer_links: [{ label: 'Privacy', url: '/privacy' }],
      email_from_name: 'Acme',
      email_from_address: 'no-reply@acme.test',
      scrape_mode: 'weekly',
      scrape_days: 7,
      updated_at: '2026-03-01T06:00:00Z',
      updated_by: 1,
    });
    vi.mocked(validateImage).mockResolvedValue({
      valid: true,
      compressedBase64: 'data:image/png;base64,compressed',
    });

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.dbClient = { query: vi.fn() };
      req.org = { id: 1, slug: 'acme', name: 'Acme', status: 'active' };
      next();
    });

    const router = (await import('./org-settings.js')).default;
    app.use('/api/org/:slug/settings', router);
    app.use(errorHandler);
  });

  it('rejects incompatible import versions', async () => {
    const response = await request(app)
      .post('/api/org/acme/settings/import')
      .set('Authorization', 'Bearer valid-token')
      .send({ version: '2.0', settings: {} });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Incompatible version');
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it('rejects imports missing required canonical fields after legacy normalization', async () => {
    const response = await request(app)
      .post('/api/org/acme/settings/import')
      .set('Authorization', 'Bearer valid-token')
      .send({
        version: '1.0',
        settings: {
          site_name: 'Legacy only',
          color_border: '#E5E7EB',
          color_text: '#111827',
          font_family_heading: 'Inter',
          font_family_body: 'Roboto',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required field');
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it('normalizes legacy payloads before required-field validation', async () => {
    const response = await request(app)
      .post('/api/org/acme/settings/import')
      .set('Authorization', 'Bearer valid-token')
      .send({
        version: '1.0',
        settings: {
          site_name: 'Legacy Cinema',
          logo_base64: 'data:image/png;base64,raw-logo',
          favicon_base64: 'data:image/png;base64,raw-favicon',
          color_primary: '#FECC00',
          color_secondary: '#1F2937',
          color_accent: '#F59E0B',
          color_background: '#FFFFFF',
          color_border: '#F3F4F6',
          color_text: '#111827',
          color_text_secondary: '#6B7280',
          color_success: '#10B981',
          color_error: '#EF4444',
          font_family_heading: 'Inter',
          font_family_body: 'Roboto',
          email_from_name: 'Acme',
          email_from_address: 'no-reply@acme.test',
          footer_links: [{ text: 'Terms', url: '/terms' }],
        },
      });

    expect(response.status).toBe(200);
    expect(validateImage).toHaveBeenNthCalledWith(1, 'data:image/png;base64,raw-logo', 'logo', 200000);
    expect(validateImage).toHaveBeenNthCalledWith(2, 'data:image/png;base64,raw-favicon', 'favicon', 50000);
    expect(updateSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_base64: 'data:image/png;base64,compressed',
        favicon_base64: 'data:image/png;base64,compressed',
        color_surface: '#F3F4F6',
        color_text_primary: '#111827',
        font_primary: 'Inter',
        font_secondary: 'Roboto',
        footer_links: [{ label: 'Terms', url: '/terms' }],
      }),
      1,
    );
  });

  it('rejects invalid imported logo images with the same contract as server settings', async () => {
    vi.mocked(validateImage).mockResolvedValueOnce({
      valid: false,
      error: 'Invalid image data',
    });

    const response = await request(app)
      .post('/api/org/acme/settings/import')
      .set('Authorization', 'Bearer valid-token')
      .send({
        version: '1.0',
        settings: {
          site_name: 'Legacy Cinema',
          logo_base64: 'data:image/png;base64,bad-logo',
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
          email_from_name: 'Acme',
          email_from_address: 'no-reply@acme.test',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid logo');
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it('rejects invalid org setting logos on update with the same contract as server settings', async () => {
    vi.mocked(validateImage).mockResolvedValueOnce({
      valid: false,
      error: 'Invalid image data',
    });

    const response = await request(app)
      .put('/api/org/acme/settings/admin')
      .set('Authorization', 'Bearer valid-token')
      .send({ logo_base64: 'data:image/png;base64,bad-logo' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid logo');
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it('exports footer_links with legacy text for round-trip compatibility', async () => {
    getSettingsMock.mockResolvedValue({
      id: 1,
      site_name: 'Updated Org',
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
      footer_links: [{ label: 'Privacy', url: '/privacy' }],
      email_from_name: 'Acme',
      email_from_address: 'no-reply@acme.test',
      scrape_mode: 'weekly',
      scrape_days: 7,
      updated_at: '2026-03-01T06:00:00Z',
      updated_by: 1,
    });

    const response = await request(app)
      .post('/api/org/acme/settings/export')
      .set('Authorization', 'Bearer valid-token')
      .send();

    expect(response.status).toBe(200);
    expect(response.body.data.settings.footer_links).toEqual([
      { label: 'Privacy', text: 'Privacy', url: '/privacy' },
    ]);
  });
});
