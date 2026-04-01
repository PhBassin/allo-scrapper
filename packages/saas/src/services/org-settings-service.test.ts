import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeClient(rows: unknown[] = []): PoolClient & { query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  return { query, release: vi.fn() } as unknown as PoolClient & { query: ReturnType<typeof vi.fn> };
}

const SETTINGS_ROW = {
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
  footer_text: 'Footer here',
  footer_links: '[]',
  email_from_name: 'My Cinema',
  email_from_address: 'no-reply@mycinema.com',
  scrape_mode: 'weekly',
  scrape_days: 7,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
};

// ── OrgSettingsService ────────────────────────────────────────────────────────

describe('OrgSettingsService', async () => {
  // Import here (after mocks if any) — will fail until the file exists
  const { OrgSettingsService } = await import('./org-settings-service.js');

  describe('getSettings', () => {
    it('returns full settings from org_settings table', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      const result = await svc.getSettings();

      expect(result).toBeDefined();
      expect(result!.site_name).toBe('My Cinema');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT \* FROM org_settings WHERE id = 1/i),
      );
    });

    it('returns undefined when no row exists', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      const result = await svc.getSettings();

      expect(result).toBeUndefined();
    });

    it('parses footer_links from JSON string', async () => {
      const row = { ...SETTINGS_ROW, footer_links: '[{"label":"Home","url":"/"}]' };
      const client = makeClient([row]);
      const svc = new OrgSettingsService(client);

      const result = await svc.getSettings();

      expect(Array.isArray(result!.footer_links)).toBe(true);
      expect(result!.footer_links[0]).toEqual({ label: 'Home', url: '/' });
    });

    it('handles footer_links already parsed as array (JSONB)', async () => {
      const row = { ...SETTINGS_ROW, footer_links: [{ label: 'Home', url: '/' }] };
      const client = makeClient([row]);
      const svc = new OrgSettingsService(client);

      const result = await svc.getSettings();

      expect(Array.isArray(result!.footer_links)).toBe(true);
    });
  });

  describe('getPublicSettings', () => {
    it('returns public settings without sensitive fields', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      const result = await svc.getPublicSettings();

      expect(result).toBeDefined();
      expect((result as Record<string, unknown>).email_from_name).toBeUndefined();
      expect((result as Record<string, unknown>).email_from_address).toBeUndefined();
      expect((result as Record<string, unknown>).updated_at).toBeUndefined();
      expect((result as Record<string, unknown>).id).toBeUndefined();
      expect(result!.site_name).toBe('My Cinema');
    });

    it('returns undefined when no row exists', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      const result = await svc.getPublicSettings();

      expect(result).toBeUndefined();
    });
  });

  describe('updateSettings', () => {
    it('builds a dynamic UPDATE query for provided fields', async () => {
      const updated = { ...SETTINGS_ROW, site_name: 'Updated Cinema' };
      const client = makeClient([updated]);
      const svc = new OrgSettingsService(client);

      const result = await svc.updateSettings({ site_name: 'Updated Cinema' }, 42);

      expect(result!.site_name).toBe('Updated Cinema');
      const call = client.query.mock.calls[0];
      expect(call[0]).toMatch(/UPDATE org_settings/i);
      expect(call[0]).toMatch(/site_name/i);
    });

    it('stringifies footer_links as JSONB', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      await svc.updateSettings({ footer_links: [{ label: 'A', url: 'https://a.com' }] }, 1);

      const call = client.query.mock.calls[0];
      // Param should contain stringified JSON
      const params: unknown[] = call[1];
      expect(params.some((p) => typeof p === 'string' && p.includes('"label"'))).toBe(true);
    });

    it('always updates updated_at and updated_by', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      await svc.updateSettings({ site_name: 'X' }, 7);

      const call = client.query.mock.calls[0];
      expect(call[0]).toMatch(/updated_at/i);
      expect(call[0]).toMatch(/updated_by/i);
      expect(call[1]).toContain(7);
    });

    it('returns undefined when row is not found after update', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      const result = await svc.updateSettings({ site_name: 'X' }, 1);

      expect(result).toBeUndefined();
    });
  });

  describe('resetSettings', () => {
    it('resets all columns to default values', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      const result = await svc.resetSettings(5);

      expect(result).toBeDefined();
      const call = client.query.mock.calls[0];
      expect(call[0]).toMatch(/UPDATE org_settings/i);
      expect(call[0]).toMatch(/site_name\s*=\s*'Allo-Scrapper'/i);
      expect(call[1]).toContain(5); // userId param
    });

    it('returns undefined when row not found', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      const result = await svc.resetSettings(1);

      expect(result).toBeUndefined();
    });
  });

  describe('exportSettings', () => {
    it('returns an export object with version 1.0 and settings', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      const result = await svc.exportSettings();

      expect(result).toBeDefined();
      expect(result!.version).toBe('1.0');
      expect(result!.exported_at).toBeDefined();
      expect(result!.settings.site_name).toBe('My Cinema');
      // Export must not include id / updated_at / updated_by
      expect((result!.settings as Record<string, unknown>).id).toBeUndefined();
      expect((result!.settings as Record<string, unknown>).updated_at).toBeUndefined();
    });

    it('returns undefined when no settings row exists', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      expect(await svc.exportSettings()).toBeUndefined();
    });
  });

  describe('importSettings', () => {
    it('applies exported settings via updateSettings', async () => {
      const client = makeClient([SETTINGS_ROW]);
      const svc = new OrgSettingsService(client);

      const exportData = {
        version: '1.0',
        exported_at: '2026-01-01T00:00:00.000Z',
        settings: {
          site_name: 'Imported Cinema',
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
          email_from_name: 'Imported',
          email_from_address: 'import@example.com',
          logo_base64: null,
          favicon_base64: null,
          footer_text: null,
          footer_links: [],
          scrape_mode: 'weekly' as const,
          scrape_days: 7,
        },
      };

      const result = await svc.importSettings(exportData, 1);

      expect(result).toBeDefined();
    });

    it('throws when version is not 1.0', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      await expect(
        svc.importSettings(
          {
            version: '2.0',
            exported_at: new Date().toISOString(),
            settings: {} as never,
          },
          1,
        ),
      ).rejects.toThrow(/incompatible version/i);
    });

    it('throws when required fields are missing', async () => {
      const client = makeClient([]);
      const svc = new OrgSettingsService(client);

      await expect(
        svc.importSettings(
          {
            version: '1.0',
            exported_at: new Date().toISOString(),
            settings: { site_name: 'only-one-field' } as never,
          },
          1,
        ),
      ).rejects.toThrow(/missing required field/i);
    });
  });
});
