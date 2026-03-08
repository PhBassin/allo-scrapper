import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import settingsRouter from './settings.js';
import type { DB } from '../db/client.js';

// Mock dependencies
vi.mock('../db/settings-queries.js');
vi.mock('../utils/image-validator.js');
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, username: 'admin' };
      next();
    } else {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  },
}));
vi.mock('../middleware/admin.js', () => ({
  requireAdmin: async (req: any, res: any, next: any) => {
    if (req.user?.id === 1) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin required' });
    }
  },
}));

import * as settingsQueries from '../db/settings-queries.js';
import * as imageValidator from '../utils/image-validator.js';

describe('Settings Routes', () => {
  let app: express.Application;
  const mockDb: DB = {} as DB;

  beforeEach(() => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.set('db', mockDb);
    app.use('/api/settings', settingsRouter);
    vi.clearAllMocks();
  });

  describe('GET /api/settings (public)', () => {
    it('should return public settings without authentication', async () => {
      const mockPublicSettings = {
        site_name: 'Test Cinema',
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

      vi.mocked(settingsQueries.getPublicSettings).mockResolvedValue(mockPublicSettings);

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPublicSettings);
    });

    it('should return 404 if settings not found', async () => {
      vi.mocked(settingsQueries.getPublicSettings).mockResolvedValue(undefined);

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/settings/admin (admin only)', () => {
    it('should return full settings for admin users', async () => {
      const mockSettings = {
        id: 1,
        site_name: 'Test Cinema',
        email_from_name: 'Test Cinema',
        email_from_address: 'no-reply@test.com',
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
        logo_base64: null,
        favicon_base64: null,
        updated_at: '2026-03-01T06:00:00Z',
        updated_by: 1,
      };

      vi.mocked(settingsQueries.getSettings).mockResolvedValue(mockSettings);

      const response = await request(app)
        .get('/api/settings/admin')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSettings);
      expect(response.body.data.email_from_address).toBe('no-reply@test.com');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/settings/admin');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/settings (admin only)', () => {
    it('should update settings with valid data', async () => {
      const updates = {
        site_name: 'Updated Cinema',
        color_primary: '#FF0000',
      };

      const updatedSettings = {
        id: 1,
        ...updates,
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
        logo_base64: null,
        favicon_base64: null,
        email_from_name: 'Test',
        email_from_address: 'test@test.com',
        updated_at: '2026-03-01T06:00:00Z',
        updated_by: 1,
      };

      vi.mocked(settingsQueries.updateSettings).mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.site_name).toBe('Updated Cinema');
    });

    it('should validate and compress logo image', async () => {
      const validLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      vi.mocked(imageValidator.validateImage).mockResolvedValue({
        valid: true,
        compressedBase64: validLogo,
      });

      vi.mocked(settingsQueries.updateSettings).mockResolvedValue({} as any);

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ logo_base64: validLogo });

      expect(imageValidator.validateImage).toHaveBeenCalledWith(validLogo, 'logo', 200000);
      expect(response.status).toBe(200);
    });

    it('should reject invalid logo image', async () => {
      const invalidLogo = 'data:image/png;base64,invalid';

      vi.mocked(imageValidator.validateImage).mockResolvedValue({
        valid: false,
        error: 'Invalid image data',
      });

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ logo_base64: invalidLogo });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid logo');
    });

    it('should validate and compress favicon image', async () => {
      const validFavicon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      vi.mocked(imageValidator.validateImage).mockResolvedValue({
        valid: true,
        compressedBase64: validFavicon,
      });

      vi.mocked(settingsQueries.updateSettings).mockResolvedValue({} as any);

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ favicon_base64: validFavicon });

      expect(imageValidator.validateImage).toHaveBeenCalledWith(validFavicon, 'favicon', 50000);
      expect(response.status).toBe(200);
    });

    it('should reject footer links with unsafe protocols (XSS prevention)', async () => {
      const updates = {
        footer_links: [
          { label: 'Safe Link', url: 'https://example.com' },
          { label: 'Unsafe Link', url: 'javascript:alert(1)' },
        ],
      };

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send(updates);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid URL protocol in footer link');
      expect(settingsQueries.updateSettings).not.toHaveBeenCalled();
    });

    it('should allow footer links with safe protocols', async () => {
      const updates = {
        footer_links: [
          { label: 'Safe HTTPS', url: 'https://example.com' },
          { label: 'Safe HTTP', url: 'http://example.com' },
          { label: 'Safe Mailto', url: 'mailto:test@example.com' },
        ],
      };

      vi.mocked(settingsQueries.updateSettings).mockResolvedValue({} as any);

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Need to use expect.anything() for db connection parameter
      expect(settingsQueries.updateSettings).toHaveBeenCalledWith(expect.anything(), updates, 1);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({ site_name: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/settings/reset (admin only)', () => {
    it('should reset settings to defaults', async () => {
      const defaultSettings = {
        id: 1,
        site_name: 'Allo-Scrapper',
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
        email_from_name: 'Allo-Scrapper',
        email_from_address: 'no-reply@allocine-scrapper.com',
        updated_at: '2026-03-01T06:00:00Z',
        updated_by: 1,
      };

      vi.mocked(settingsQueries.resetSettings).mockResolvedValue(defaultSettings);

      const response = await request(app)
        .post('/api/settings/reset')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.site_name).toBe('Allo-Scrapper');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).post('/api/settings/reset');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/settings/export (admin only)', () => {
    it('should export settings as JSON', async () => {
      const exportData = {
        version: '1.0',
        exported_at: '2026-03-01T06:00:00Z',
        settings: {
          site_name: 'Test Cinema',
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
          email_from_name: 'Test',
          email_from_address: 'test@test.com',
        },
      };

      vi.mocked(settingsQueries.exportSettings).mockResolvedValue(exportData);

      const response = await request(app)
        .post('/api/settings/export')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('1.0');
    });
  });

  describe('POST /api/settings/import (admin only)', () => {
    it('should import settings from JSON', async () => {
      const importData = {
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
          footer_text: null,
          footer_links: [],
          email_from_name: 'Imported',
          email_from_address: 'import@test.com',
        },
      };

      vi.mocked(settingsQueries.importSettings).mockResolvedValue({
        id: 1,
        ...importData.settings,
        updated_at: '2026-03-01T06:00:00Z',
        updated_by: 1,
      } as any);

      const response = await request(app)
        .post('/api/settings/import')
        .set('Authorization', 'Bearer valid-token')
        .send(importData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid import data', async () => {
      const invalidData = {
        version: '2.0', // Wrong version
        settings: {},
      };

      vi.mocked(settingsQueries.importSettings).mockRejectedValue(
        new Error('Incompatible version')
      );

      const response = await request(app)
        .post('/api/settings/import')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/settings/import')
        .send({ version: '1.0', settings: {} });

      expect(response.status).toBe(401);
    });
  });
});
