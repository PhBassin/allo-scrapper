import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgSettingsService } from './org-settings-service.js';
import type { DB } from '../db/types.js';

describe('OrgSettingsService', () => {
  let mockDb: DB;
  let service: OrgSettingsService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
    service = new OrgSettingsService(mockDb);
  });

  describe('getPublicSettings', () => {
    it('returns public-facing org settings', async () => {
      const settingsRow = {
        id: 1,
        site_name: 'My Cinema',
        logo_url: 'https://example.com/logo.png',
        favicon_url: 'https://example.com/favicon.ico',
        primary_color: '#FECC00',
        secondary_color: '#1F2937',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        footer_text: 'Contact us at info@cinema.com',
        updated_at: '2026-04-07T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [settingsRow],
        rowCount: 1,
      });

      const result = await service.getPublicSettings();

      expect(result).toEqual(settingsRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        undefined
      );
    });

    it('returns null if no settings row exists', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await service.getPublicSettings();

      expect(result).toBeNull();
    });
  });

  describe('getAdminSettings', () => {
    it('returns all org settings including email config', async () => {
      const adminRow = {
        id: 1,
        site_name: 'My Cinema',
        logo_url: 'https://example.com/logo.png',
        favicon_url: 'https://example.com/favicon.ico',
        primary_color: '#FECC00',
        secondary_color: '#1F2937',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        footer_text: 'Contact us',
        email_from_name: 'My Cinema',
        email_from_address: 'noreply@cinema.com',
        scrape_mode: 'weekly',
        scrape_days: 7,
        updated_at: '2026-04-07T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [adminRow],
        rowCount: 1,
      });

      const result = await service.getAdminSettings();

      expect(result).toEqual(adminRow);
    });

    it('returns null if no settings row exists', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await service.getAdminSettings();

      expect(result).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('updates settings and returns updated row', async () => {
      const updates = {
        site_name: 'New Name',
        primary_color: '#FF5733',
      };

      const updatedRow = {
        id: 1,
        site_name: 'New Name',
        primary_color: '#FF5733',
        secondary_color: '#1F2937',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        footer_text: 'Contact us',
        updated_at: '2026-04-07T01:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [updatedRow],
        rowCount: 1,
      });

      const result = await service.updateSettings(updates);

      expect(result).toEqual(updatedRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_settings'),
        expect.any(Array)
      );
    });

    it('handles email config updates', async () => {
      const updates = {
        email_from_name: 'Cinema Team',
        email_from_address: 'support@cinema.com',
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ id: 1, ...updates }],
        rowCount: 1,
      });

      const result = await service.updateSettings(updates);

      expect(result).toHaveProperty('email_from_name', 'Cinema Team');
      expect(result).toHaveProperty('email_from_address', 'support@cinema.com');
    });
  });

  describe('resetToDefaults', () => {
    it('resets all settings to default values', async () => {
      const defaultSettings = {
        id: 1,
        site_name: 'My Cinema',
        logo_url: null,
        favicon_url: null,
        primary_color: '#FECC00',
        secondary_color: '#1F2937',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        footer_text: null,
        email_from_name: null,
        email_from_address: null,
        scrape_mode: 'weekly',
        scrape_days: 7,
        updated_at: '2026-04-07T02:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [defaultSettings],
        rowCount: 1,
      });

      const result = await service.resetToDefaults();

      expect(result).toEqual(defaultSettings);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_settings'),
        expect.any(Array)
      );
    });
  });

  describe('updateLogo', () => {
    it('updates logo_url field', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.updateLogo('https://cdn.example.com/new-logo.png');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_settings'),
        expect.arrayContaining(['https://cdn.example.com/new-logo.png'])
      );
    });
  });

  describe('updateFavicon', () => {
    it('updates favicon_url field', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.updateFavicon('https://cdn.example.com/favicon.ico');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_settings'),
        expect.arrayContaining(['https://cdn.example.com/favicon.ico'])
      );
    });
  });
});
