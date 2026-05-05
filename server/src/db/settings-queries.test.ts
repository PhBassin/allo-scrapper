import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DB } from './client.js';
import {
  getSettings,
  getPublicSettings,
  updateSettings,
  resetSettings,
  exportSettings,
  importSettings,
  type AppSettingsRow,
} from './settings-queries.js';
import type { AppSettings, AppSettingsUpdate, AppSettingsExport } from '../types/settings.js';

// Mock database
function createMockDb(): DB {
  return {
    query: vi.fn(),
  } as unknown as DB;
}

// Default mock settings row
const mockSettingsRow: AppSettingsRow = {
  id: 1,
  site_name: 'Test Cinema',
  logo_base64: 'data:image/png;base64,test-logo',
  favicon_base64: 'data:image/png;base64,test-favicon',
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
  footer_text: 'Test footer',
  footer_links: JSON.stringify([{ label: 'Home', url: '/' }]),
  email_from_name: 'Test Cinema',
  email_from_address: 'no-reply@test.com',
  updated_at: '2026-03-01T06:00:00Z',
  updated_by: 1,
};

describe('Settings Queries', () => {
  let db: DB;

  beforeEach(() => {
    db = createMockDb();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return full settings for admin users', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      const result = await getSettings(db);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.site_name).toBe('Test Cinema');
      expect(result?.email_from_address).toBe('no-reply@test.com');
      expect(result?.footer_links).toEqual([{ label: 'Home', url: '/' }]);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM app_settings WHERE id = 1');
    });

    it('should parse footer_links JSON array', async () => {
      const rowWithLinks = {
        ...mockSettingsRow,
        footer_links: JSON.stringify([
          { label: 'About', url: '/about' },
          { label: 'Contact', url: '/contact' },
        ]),
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [rowWithLinks],
        rowCount: 1,
      } as any);

      const result = await getSettings(db);

      expect(result?.footer_links).toEqual([
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' },
      ]);
    });

    it('should return undefined if no settings found', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await getSettings(db);

      expect(result).toBeUndefined();
    });

    it('should handle empty footer_links array', async () => {
      const rowWithEmptyLinks = {
        ...mockSettingsRow,
        footer_links: JSON.stringify([]),
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [rowWithEmptyLinks],
        rowCount: 1,
      } as any);

      const result = await getSettings(db);

      expect(result?.footer_links).toEqual([]);
    });
  });

  describe('getPublicSettings', () => {
    it('should return only public fields (no email config)', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      const result = await getPublicSettings(db);

      expect(result).toBeDefined();
      expect(result?.site_name).toBe('Test Cinema');
      expect(result?.color_primary).toBe('#FECC00');
      expect(result).not.toHaveProperty('email_from_address');
      expect(result).not.toHaveProperty('email_from_name');
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('updated_at');
      expect(result).not.toHaveProperty('updated_by');
    });

    it('should return undefined if no settings found', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await getPublicSettings(db);

      expect(result).toBeUndefined();
    });
  });

  describe('updateSettings', () => {
    it('should update only provided fields', async () => {
      const updates: AppSettingsUpdate = {
        site_name: 'Updated Cinema',
        color_primary: '#FF0000',
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [{ ...mockSettingsRow, ...updates }],
        rowCount: 1,
      } as any);

      const result = await updateSettings(db, updates, 1);

      expect(result).toBeDefined();
      expect(result?.site_name).toBe('Updated Cinema');
      expect(result?.color_primary).toBe('#FF0000');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app_settings'),
        expect.any(Array)
      );
    });

    it('should include updated_by user ID in query', async () => {
      const updates: AppSettingsUpdate = { site_name: 'New Name' };

      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      await updateSettings(db, updates, 42);

      const queryCall = vi.mocked(db.query).mock.calls[0];
      expect(queryCall[0]).toContain('updated_by = $');
      expect(queryCall[1]).toContain(42);
    });

    it('should handle logo and favicon updates', async () => {
      const updates: AppSettingsUpdate = {
        logo_base64: 'data:image/png;base64,new-logo',
        favicon_base64: null, // Remove favicon
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [{ ...mockSettingsRow, ...updates }],
        rowCount: 1,
      } as any);

      const result = await updateSettings(db, updates, 1);

      expect(result?.logo_base64).toBe('data:image/png;base64,new-logo');
      expect(result?.favicon_base64).toBeNull();
    });

    it('should reject footer_links when provided as null', async () => {
      await expect(updateSettings(db, { footer_links: null as any }, 1)).rejects.toThrow(
        /footer_links must be an array/i
      );
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should reject footer links missing a label', async () => {
      await expect(
        updateSettings(db, { footer_links: [{ url: 'https://example.com' } as any] }, 1)
      ).rejects.toThrow(/non-empty label/i);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should reject footer links missing a url', async () => {
      await expect(
        updateSettings(db, { footer_links: [{ label: 'Privacy' } as any] }, 1)
      ).rejects.toThrow(/non-empty url/i);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should handle footer_links array updates', async () => {
      const updates: AppSettingsUpdate = {
        footer_links: [
          { label: 'Privacy', url: '/privacy' },
          { label: 'Terms', url: '/terms' },
        ],
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      await updateSettings(db, updates, 1);

      const queryCall = vi.mocked(db.query).mock.calls[0];
      // Should stringify the footer_links array
      expect(queryCall[1]).toContain(JSON.stringify(updates.footer_links));
    });

    it('should return undefined if update fails', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await updateSettings(db, { site_name: 'Test' }, 1);

      expect(result).toBeUndefined();
    });

    it('should handle empty updates object gracefully', async () => {
      const updates: AppSettingsUpdate = {};

      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      const result = await updateSettings(db, updates, 1);

      // Should still work but not change anything
      expect(result).toBeDefined();
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to default values', async () => {
      const defaultSettings = {
        ...mockSettingsRow,
        site_name: 'Allo-Scrapper',
        logo_base64: null,
        favicon_base64: null,
        color_primary: '#FECC00',
        color_secondary: '#1F2937',
        footer_text: null,
        footer_links: JSON.stringify([]),
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [defaultSettings],
        rowCount: 1,
      } as any);

      const result = await resetSettings(db, 1);

      expect(result).toBeDefined();
      expect(result?.site_name).toBe('Allo-Scrapper');
      expect(result?.logo_base64).toBeNull();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app_settings'),
        expect.arrayContaining([1]) // updated_by
      );
    });

    it('should set updated_by to the user who reset', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      await resetSettings(db, 99);

      const queryCall = vi.mocked(db.query).mock.calls[0];
      expect(queryCall[1]).toContain(99);
    });
  });

  describe('exportSettings', () => {
    it('should export settings with version and timestamp', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      const result = await exportSettings(db);

      expect(result).toBeDefined();
      expect(result?.version).toBe('1.0');
      expect(result?.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
      expect(result?.settings.site_name).toBe('Test Cinema');
      expect(result?.settings).not.toHaveProperty('id');
      expect(result?.settings).not.toHaveProperty('updated_at');
      expect(result?.settings).not.toHaveProperty('updated_by');
    });

    it('should return undefined if no settings to export', async () => {
      vi.mocked(db.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await exportSettings(db);

      expect(result).toBeUndefined();
    });
  });

  describe('importSettings', () => {
    it('should import settings from export format', async () => {
      const exportData: AppSettingsExport = {
        version: '1.0',
        exported_at: '2026-03-01T05:00:00Z',
        settings: {
          site_name: 'Imported Cinema',
          logo_base64: 'data:image/png;base64,imported',
          favicon_base64: null,
          color_primary: '#000000',
          color_secondary: '#FFFFFF',
          color_accent: '#FF00FF',
          color_background: '#FAFAFA',
          color_surface: '#F0F0F0',
          color_text_primary: '#000000',
          color_text_secondary: '#666666',
          color_success: '#00FF00',
          color_error: '#FF0000',
          font_primary: 'Arial',
          font_secondary: 'Verdana',
          footer_text: 'Imported footer',
          footer_links: [{ label: 'Link', url: '/link' }],
          email_from_name: 'Imported',
          email_from_address: 'import@test.com',
        },
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [mockSettingsRow],
        rowCount: 1,
      } as any);

      const result = await importSettings(db, exportData, 1);

      expect(result).toBeDefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app_settings'),
        expect.any(Array)
      );
    });

    it('should reject incompatible version formats', async () => {
      const badExport: AppSettingsExport = {
        version: '2.0', // Future version
        exported_at: '2026-03-01T05:00:00Z',
        settings: mockSettingsRow as any,
      };

      await expect(importSettings(db, badExport, 1)).rejects.toThrow(
        /incompatible version/i
      );
    });

    it('should validate required fields in imported data', async () => {
      const invalidExport = {
        version: '1.0',
        exported_at: '2026-03-01T05:00:00Z',
        settings: {
          site_name: 'Test',
          // Missing required color fields
        },
      } as AppSettingsExport;

      await expect(importSettings(db, invalidExport, 1)).rejects.toThrow();
    });

    it('should reject footer links with unsafe protocols during import', async () => {
      const invalidExport: AppSettingsExport = {
        version: '1.0',
        exported_at: '2026-03-01T05:00:00Z',
        settings: {
          site_name: 'Imported Cinema',
          logo_base64: null,
          favicon_base64: null,
          color_primary: '#000000',
          color_secondary: '#FFFFFF',
          color_accent: '#FF00FF',
          color_background: '#FAFAFA',
          color_surface: '#F0F0F0',
          color_text_primary: '#000000',
          color_text_secondary: '#666666',
          color_success: '#00FF00',
          color_error: '#FF0000',
          font_primary: 'Arial',
          font_secondary: 'Verdana',
          footer_text: 'Imported footer',
          footer_links: [{ label: 'Owned', url: 'javascript:alert(1)' }],
          email_from_name: 'Imported',
          email_from_address: 'import@test.com',
        },
      };

      await expect(importSettings(db, invalidExport, 1)).rejects.toThrow(
        /invalid url protocol in footer link/i
      );
      expect(db.query).not.toHaveBeenCalled();
    });
  });
});
