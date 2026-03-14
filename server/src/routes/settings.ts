import express, { Response, NextFunction } from 'express';
import type { DB } from '../db/client.js';
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
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const router = express.Router();

// Size limits for images (in bytes)
const LOGO_MAX_SIZE = 200000; // 200 KB
const FAVICON_MAX_SIZE = 50000; // 50 KB

/**
 * GET /api/settings (public)
 * Returns public settings for theming (no authentication required)
 */
router.get('/', async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const settings = await getPublicSettings(db);

    if (!settings) {
      return next(new NotFoundError('Settings not found'));
    }

    const response: ApiResponse = {
      success: true,
      data: settings,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/admin (admin only)
 * Returns full settings including email configuration
 */
router.get('/admin', protectedLimiter, requireAuth, requirePermission('settings:read'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const settings = await getSettings(db);

    if (!settings) {
      return next(new NotFoundError('Settings not found'));
    }

    const response: ApiResponse = {
      success: true,
      data: settings,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings (admin only)
 * Update settings
 */
router.put('/', protectedLimiter, requireAuth, requirePermission('settings:update'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const db: DB = req.app.get('db');
    const updates: AppSettingsUpdate = req.body;

    // Validate and compress logo if provided
    if (updates.logo_base64) {
      const logoValidation = await validateImage(updates.logo_base64, 'logo', LOGO_MAX_SIZE);
      if (!logoValidation.valid) {
        return next(new ValidationError(`Invalid logo: ${logoValidation.error}`));
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
        return next(new ValidationError(`Invalid favicon: ${faviconValidation.error}`));
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
              return next(new ValidationError(`Invalid URL protocol in footer link: ${link.url}`));
            }
          } catch (e) {
            return next(new ValidationError(`Invalid URL format in footer link: ${link.url}`));
          }
        }
      }
    }

    const updatedSettings = await updateSettings(db, updates, req.user!.id);

    if (!updatedSettings) {
      return next(new Error('Failed to update settings'));
    }

    logger.info(`Settings updated by user ${req.user!.username}`, {
      userId: req.user!.id,
      updatedFields: Object.keys(updates),
    });

    const response: ApiResponse = {
      success: true,
      data: updatedSettings,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/reset (admin only)
 * Reset settings to default values
 */
router.post('/reset', protectedLimiter, requireAuth, requirePermission('settings:reset'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const db: DB = req.app.get('db');
    const defaultSettings = await resetSettings(db, req.user!.id);

    if (!defaultSettings) {
      return next(new Error('Failed to reset settings'));
    }

    logger.info(`Settings reset to defaults by user ${req.user!.username}`, {
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      data: defaultSettings,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/export (admin only)
 * Export settings as JSON for backup
 */
router.post('/export', protectedLimiter, requireAuth, requirePermission('settings:export'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const db: DB = req.app.get('db');
    const exportData = await exportSettings(db);

    if (!exportData) {
      return next(new NotFoundError('No settings to export'));
    }

    logger.info('Settings exported', {
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      data: exportData,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/import (admin only)
 * Import settings from JSON backup
 */
router.post('/import', protectedLimiter, requireAuth, requirePermission('settings:import'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const db: DB = req.app.get('db');
    const importData: AppSettingsExport = req.body;

    // Validate import data structure
    if (!importData.version || !importData.settings) {
      return next(new ValidationError('Invalid import data format'));
    }

    const importedSettings = await importSettings(db, importData, req.user!.id);

    if (!importedSettings) {
      return next(new Error('Failed to import settings'));
    }

    logger.info(`Settings imported by user ${req.user!.username}`, {
      userId: req.user!.id,
      version: importData.version,
    });

    const response: ApiResponse = {
      success: true,
      data: importedSettings,
    };
    res.json(response);
  } catch (error) {
    return next(error instanceof Error ? new ValidationError(error.message) : error);
  }
});

export default router;
