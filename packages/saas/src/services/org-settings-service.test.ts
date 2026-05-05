import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgSettingsService, type OrgSettingsRow } from './org-settings-service.js';
import type { DB, FooterLink } from '../db/types.js';
import { extractSupportedGoogleFont, isValidThemeFontValue } from '../routes/org-settings-fonts.js';

describe('OrgSettingsService', () => {
  let mockDb: DB;
  let service: OrgSettingsService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
    service = new OrgSettingsService(mockDb);
  });

  const sampleRow: OrgSettingsRow = {
    id: 1,
    site_name: 'My Cinema',
    logo_base64: 'data:image/png;base64,abc',
    favicon_base64: 'data:image/x-icon;base64,def',
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
    footer_text: 'Contact us',
    footer_links: JSON.stringify([{ label: 'Privacy', text: 'Privacy', url: '/privacy' }]),
    email_from_name: 'Allo-Scrapper',
    email_from_address: 'no-reply@allocine-scrapper.com',
    scrape_mode: 'weekly',
    scrape_days: 7,
    updated_at: '2026-04-07T00:00:00Z',
    updated_by: 42,
  };

  describe('getSettings', () => {
    it('returns full org settings', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [sampleRow],
        rowCount: 1,
      });

      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(result?.site_name).toBe('My Cinema');
      expect(result?.footer_links).toEqual([{ label: 'Privacy', text: 'Privacy', url: '/privacy' }]);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM app_settings WHERE id = 1');
    });

    it('returns undefined if no settings row exists', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await service.getSettings();

      expect(result).toBeUndefined();
    });
  });

  describe('getPublicSettings', () => {
    it('returns public-facing org settings (without email config)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [sampleRow],
        rowCount: 1,
      });

      const result = await service.getPublicSettings();

      expect(result).toBeDefined();
      expect(result?.site_name).toBe('My Cinema');
      expect(result).not.toHaveProperty('email_from_name');
      expect(result).not.toHaveProperty('email_from_address');
      expect(result).not.toHaveProperty('updated_by');
    });
  });

  describe('updateSettings', () => {
    it('rejects footer_links when provided as null', async () => {
      await expect(service.updateSettings({ footer_links: null as any }, 42)).rejects.toThrow(
        /footer_links must be an array/i
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects footer links missing a label', async () => {
      await expect(
        service.updateSettings({ footer_links: [{ url: '/terms' } as any] }, 42)
      ).rejects.toThrow(/non-empty label/i);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects footer links missing a url', async () => {
      await expect(
        service.updateSettings({ footer_links: [{ label: 'Terms', text: 'Terms' } as any] }, 42)
      ).rejects.toThrow(/non-empty url/i);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('updates settings and returns updated row', async () => {
      const updates = {
        site_name: 'New Name',
        color_primary: '#FF5733',
        footer_links: [{ label: 'Terms', text: 'Terms', url: '/terms' }] as FooterLink[],
      };

      const updatedRow = { ...sampleRow, ...updates, footer_links: JSON.stringify(updates.footer_links) };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [updatedRow],
        rowCount: 1,
      });

      const result = await service.updateSettings(updates, 42);

      expect(result).toBeDefined();
      expect(result?.site_name).toBe('New Name');
      expect(result?.color_primary).toBe('#FF5733');
      expect(result?.footer_links).toEqual(updates.footer_links);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app_settings'),
        expect.any(Array)
      );
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to default values', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [sampleRow],
        rowCount: 1,
      });

      const result = await service.resetSettings(42);

      expect(result).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app_settings'),
        expect.arrayContaining([42])
      );
    });
  });

  describe('theme font validation helpers', () => {
    it('accepts supported Google Fonts and system fonts', () => {
      expect(isValidThemeFontValue('Poppins')).toBe(true);
      expect(isValidThemeFontValue('Georgia')).toBe(true);
      expect(isValidThemeFontValue('Inter, sans-serif')).toBe(true);
    });

    it('rejects unsupported or unsafe font values', () => {
      expect(isValidThemeFontValue('Papyrus')).toBe(false);
      expect(isValidThemeFontValue('Roboto; color:red')).toBe(false);
      expect(isValidThemeFontValue('')).toBe(false);
    });

    it('extracts only supported Google Fonts for CSS imports', () => {
      expect(extractSupportedGoogleFont('Poppins')).toBe('Poppins');
      expect(extractSupportedGoogleFont('Inter, sans-serif')).toBe('Inter');
      expect(extractSupportedGoogleFont('Georgia')).toBeNull();
      expect(extractSupportedGoogleFont('Papyrus')).toBeNull();
    });
  });
});
