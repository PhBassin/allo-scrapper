import express, { Response, NextFunction } from 'express';
import type { DB } from '../db/client.js';
import {
  getSettings,
  getPublicSettings,
  updateSettings,
  resetSettings,
  exportSettings,
  importSettings,
  validateFooterLinks,
} from '../db/settings-queries.js';
import { validateImage } from '../utils/image-validator.js';
import type { ApiResponse } from '../types/api.js';
import type { AppSettingsUpdate, AppSettingsExport, ScrapeMode } from '../types/settings.js';
import { logger } from '../utils/logger.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const router = express.Router();

// Size limits for images (in bytes)
const LOGO_MAX_SIZE = 200000; // 200 KB
const FAVICON_MAX_SIZE = 50000; // 50 KB

const VALID_SCRAPE_MODES: ScrapeMode[] = ['weekly', 'from_today', 'from_today_limited'];
const SCRAPE_DAYS_MIN = 1;
const SCRAPE_DAYS_MAX = 14;

// Input length limits for text fields (security: prevent DoS via large payloads)
const INPUT_LIMITS = {
  site_name: 100,
  footer_text: 500,
  email_from_name: 100,
  email_from_address: 255,
  font_primary: 100,
  font_secondary: 100,
} as const;

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

    // Validate input lengths to prevent DoS via large payloads
    for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
      const value = updates[field as keyof AppSettingsUpdate];
      if (typeof value === 'string' && value.length > limit) {
        return next(new ValidationError(`${field} exceeds maximum length of ${limit} characters`));
      }
    }

    // Validate footer links in the shared server validator
    try {
      validateFooterLinks(updates.footer_links);
    } catch (error) {
      return next(new ValidationError(error instanceof Error ? error.message : 'Invalid footer_links'));
    }

    // Validate scrape_mode if provided
    if (updates.scrape_mode !== undefined) {
      if (!VALID_SCRAPE_MODES.includes(updates.scrape_mode)) {
        return next(new ValidationError(`Invalid scrape_mode: must be one of ${VALID_SCRAPE_MODES.join(', ')}`));
      }
    }

    // Validate scrape_days if provided
    if (updates.scrape_days !== undefined) {
      const days = updates.scrape_days;
      if (!Number.isInteger(days) || days < SCRAPE_DAYS_MIN || days > SCRAPE_DAYS_MAX) {
        return next(new ValidationError(`Invalid scrape_days: must be an integer between ${SCRAPE_DAYS_MIN} and ${SCRAPE_DAYS_MAX}`));
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

    // Validate input lengths to prevent DoS via large payloads
    for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
      const value = importData.settings[field as keyof AppSettingsUpdate];
      if (typeof value === 'string' && value.length > limit) {
        return next(new ValidationError(`${field} exceeds maximum length of ${limit} characters`));
      }
    }

    if (importData.settings.logo_base64) {
      const logoValidation = await validateImage(importData.settings.logo_base64, 'logo', LOGO_MAX_SIZE);
      if (!logoValidation.valid) {
        return next(new ValidationError(`Invalid logo: ${logoValidation.error}`));
      }
      importData.settings.logo_base64 = logoValidation.compressedBase64!;
    }

    if (importData.settings.favicon_base64) {
      const faviconValidation = await validateImage(importData.settings.favicon_base64, 'favicon', FAVICON_MAX_SIZE);
      if (!faviconValidation.valid) {
        return next(new ValidationError(`Invalid favicon: ${faviconValidation.error}`));
      }
      importData.settings.favicon_base64 = faviconValidation.compressedBase64!;
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
