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
import type { AppSettings, AppSettingsUpdate, AppSettingsExport } from '../types/settings.js';
import { logger } from '../utils/logger.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const router = express.Router();

// Size limits for images (in bytes)
const LOGO_MAX_SIZE = 200000; // 200 KB
const FAVICON_MAX_SIZE = 50000; // 50 KB

// Input length limits for text fields (security: prevent DoS via large payloads)
const INPUT_LIMITS = {
  site_name: 100,
  footer_text: 500,
  email_from_name: 100,
  email_from_address: 255,
  font_family_heading: 100,
  font_family_body: 100,
} as const;

/**
 * Send a JSON success response, or pass NotFoundError to next() if data is falsy.
 */
function sendJsonOrNotFound<T>(
  res: Response,
  data: T | undefined,
  next: NextFunction,
  notFoundMessage = 'Resource not found',
): void {
  if (!data) {
    next(new NotFoundError(notFoundMessage));
    return;
  }
  res.json({ success: true, data } satisfies ApiResponse);
}

/**
 * GET /api/settings (public)
 * Returns public settings for theming (no authentication required)
 */
router.get('/', async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const settings = await getPublicSettings(db);
    sendJsonOrNotFound(res, settings, next, 'Settings not found');
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
    sendJsonOrNotFound(res, settings, next, 'Settings not found');
  } catch (error) {
    next(error);
  }
});

/**
 * Validate and compress logo if provided.
 * Throws ValidationError on invalid image data.
 */
async function validateLogo(updates: AppSettingsUpdate): Promise<void> {
  if (!updates.logo_base64) return;

  const result = await validateImage(updates.logo_base64, 'logo', LOGO_MAX_SIZE);
  if (!result.valid) {
    throw new ValidationError(`Invalid logo: ${result.error}`);
  }
  updates.logo_base64 = result.compressedBase64!;
}

/**
 * Validate and compress favicon if provided.
 * Throws ValidationError on invalid image data.
 */
async function validateFavicon(updates: AppSettingsUpdate): Promise<void> {
  if (!updates.favicon_base64) return;

  const result = await validateImage(updates.favicon_base64, 'favicon', FAVICON_MAX_SIZE);
  if (!result.valid) {
    throw new ValidationError(`Invalid favicon: ${result.error}`);
  }
  updates.favicon_base64 = result.compressedBase64!;
}

/**
 * Validate input field lengths to prevent DoS via large payloads.
 * Throws ValidationError if any field exceeds its limit.
 */
function validateInputLengths(updates: AppSettingsUpdate): void {
  for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
    const value = updates[field as keyof AppSettingsUpdate];
    if (typeof value === 'string' && value.length > limit) {
      throw new ValidationError(`${field} exceeds maximum length of ${limit} characters`);
    }
  }
}

/**
 * Validate footer link URLs to prevent stored XSS via javascript: or data: URIs.
 * Throws ValidationError on unsafe or malformed URLs.
 */
function validateFooterLinks(updates: AppSettingsUpdate): void {
  if (!updates.footer_links || !Array.isArray(updates.footer_links)) return;

  for (const link of updates.footer_links) {
    if (!link.url) continue;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(link.url, 'http://dummy.com');
    } catch {
      throw new ValidationError(`Invalid URL format in footer link: ${link.url}`);
    }

    if (
      parsedUrl.protocol !== 'http:' &&
      parsedUrl.protocol !== 'https:' &&
      parsedUrl.protocol !== 'mailto:' &&
      parsedUrl.protocol !== 'tel:'
    ) {
      throw new ValidationError(`Invalid URL protocol in footer link: ${link.url}`);
    }
  }
}

/**
 * Validate settings update payload for security and correctness.
 * Delegates to specialised helpers: logo, favicon, input lengths, footer links.
 */
async function validateSettingsUpdate(updates: AppSettingsUpdate): Promise<void> {
  await validateLogo(updates);
  await validateFavicon(updates);
  validateInputLengths(updates);
  validateFooterLinks(updates);
}

/**
 * Persist settings update and return the updated document.
 * Throws Error if the update fails.
 */
async function applySettingsUpdate(
  db: DB,
  updates: AppSettingsUpdate,
  userId: number,
): Promise<AppSettings> {
  const updatedSettings = await updateSettings(db, updates, userId);
  if (!updatedSettings) {
    throw new Error('Failed to update settings');
  }
  return updatedSettings;
}

/**
 * PUT /api/settings (admin only)
 * Update settings
 */
router.put('/', protectedLimiter, requireAuth, requirePermission('settings:update'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const db: DB = req.app.get('db');
    const updates: AppSettingsUpdate = req.body;

    await validateSettingsUpdate(updates);

    const updatedSettings = await applySettingsUpdate(db, updates, req.user!.id);

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
