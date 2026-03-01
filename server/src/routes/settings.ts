import express from 'express';
import { db } from '../db/client.js';
import {
  getSettings,
  getPublicSettings,
  updateSettings,
  resetSettings,
  exportSettings,
  importSettings,
} from '../db/settings-queries.js';
import { validateImage } from '../utils/image-validator.js';
import type { ApiResponse } from '../types/api.js';
import type { AppSettingsUpdate, AppSettingsExport } from '../types/settings.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, type AuthRequest } from '../middleware/admin.js';
import { protectedLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

// Size limits for images (in bytes)
const LOGO_MAX_SIZE = 200000; // 200 KB
const FAVICON_MAX_SIZE = 50000; // 50 KB

/**
 * GET /api/settings (public)
 * Returns public settings for theming (no authentication required)
 */
router.get('/', async (_req, res) => {
  try {
    const settings = await getPublicSettings(db);

    if (!settings) {
      const response: ApiResponse = {
        success: false,
        error: 'Settings not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: settings,
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error fetching public settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch settings',
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/settings/admin (admin only)
 * Returns full settings including email configuration
 */
router.get('/admin', protectedLimiter, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const settings = await getSettings(db);

    if (!settings) {
      const response: ApiResponse = {
        success: false,
        error: 'Settings not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: settings,
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error fetching admin settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch settings',
    };
    return res.status(500).json(response);
  }
});

/**
 * PUT /api/settings (admin only)
 * Update settings
 */
router.put('/', protectedLimiter, requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updates: AppSettingsUpdate = req.body;

    // Validate and compress logo if provided
    if (updates.logo_base64) {
      const logoValidation = await validateImage(updates.logo_base64, 'logo', LOGO_MAX_SIZE);
      if (!logoValidation.valid) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid logo: ${logoValidation.error}`,
        };
        return res.status(400).json(response);
      }
      // Use compressed version
      updates.logo_base64 = logoValidation.compressedBase64!;
    }

    // Validate and compress favicon if provided
    if (updates.favicon_base64) {
      const faviconValidation = await validateImage(
        updates.favicon_base64,
        'favicon',
        FAVICON_MAX_SIZE
      );
      if (!faviconValidation.valid) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid favicon: ${faviconValidation.error}`,
        };
        return res.status(400).json(response);
      }
      // Use compressed version
      updates.favicon_base64 = faviconValidation.compressedBase64!;
    }

    // Validate footer links to prevent stored XSS via javascript: or data: URIs
    if (updates.footer_links && Array.isArray(updates.footer_links)) {
      for (const link of updates.footer_links) {
        if (link.url) {
          try {
            const parsedUrl = new URL(link.url, 'http://dummy.com');
            if (
              parsedUrl.protocol !== 'http:' &&
              parsedUrl.protocol !== 'https:' &&
              parsedUrl.protocol !== 'mailto:' &&
              parsedUrl.protocol !== 'tel:'
            ) {
              const response: ApiResponse = {
                success: false,
                error: `Invalid URL protocol in footer link: ${link.url}`,
              };
              return res.status(400).json(response);
            }
          } catch (e) {
            const response: ApiResponse = {
              success: false,
              error: `Invalid URL format in footer link: ${link.url}`,
            };
            return res.status(400).json(response);
          }
        }
      }
    }

    const updatedSettings = await updateSettings(db, updates, req.user!.id);

    if (!updatedSettings) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update settings',
      };
      return res.status(500).json(response);
    }

    logger.info(`Settings updated by user ${req.user!.username}`, {
      userId: req.user!.id,
      updatedFields: Object.keys(updates),
    });

    const response: ApiResponse = {
      success: true,
      data: updatedSettings,
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error updating settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update settings',
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/settings/reset (admin only)
 * Reset settings to default values
 */
router.post('/reset', protectedLimiter, requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const defaultSettings = await resetSettings(db, req.user!.id);

    if (!defaultSettings) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to reset settings',
      };
      return res.status(500).json(response);
    }

    logger.info(`Settings reset to defaults by user ${req.user!.username}`, {
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      data: defaultSettings,
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error resetting settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to reset settings',
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/settings/export (admin only)
 * Export settings as JSON for backup
 */
router.post('/export', protectedLimiter, requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const exportData = await exportSettings(db);

    if (!exportData) {
      const response: ApiResponse = {
        success: false,
        error: 'No settings to export',
      };
      return res.status(404).json(response);
    }

    logger.info('Settings exported', {
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      data: exportData,
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error exporting settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to export settings',
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/settings/import (admin only)
 * Import settings from JSON backup
 */
router.post('/import', protectedLimiter, requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const importData: AppSettingsExport = req.body;

    // Validate import data structure
    if (!importData.version || !importData.settings) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid import data format',
      };
      return res.status(400).json(response);
    }

    const importedSettings = await importSettings(db, importData, req.user!.id);

    if (!importedSettings) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to import settings',
      };
      return res.status(500).json(response);
    }

    logger.info(`Settings imported by user ${req.user!.username}`, {
      userId: req.user!.id,
      version: importData.version,
    });

    const response: ApiResponse = {
      success: true,
      data: importedSettings,
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error importing settings:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import settings',
    };
    return res.status(400).json(response);
  }
});

export default router;
