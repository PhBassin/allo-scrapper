/**
 * Per-org white-label settings router.
 *
 * Mounted at: /api/org/:slug/settings
 *
 * Provides endpoints for managing org-specific customization:
 * - GET / — public settings (theming)
 * - GET /admin — full settings (admin only)
 * - PUT / — update settings alias (admin only)
 * - PUT /admin — update settings (admin only)
 * - POST /export — export settings backup (admin only)
 * - POST /import — import settings backup (admin only)
 * - POST /admin/reset — reset to defaults (admin only)
 * - GET /theme.css — dynamic CSS from org colors/fonts
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { OrgSettingsService } from '../services/org-settings-service.js';
import type { DB, FooterLink, OrgSettingsPublic, OrgSettingsUpdate } from '../db/types.js';
import {
  extractSupportedGoogleFont,
  isValidThemeFontValue,
} from './org-settings-fonts.js';
import {
  generateCSSVariables,
  generateGoogleFontsImport,
} from 'allo-scrapper-server/dist/services/theme-generator.js';
import { validateImage } from 'allo-scrapper-server/dist/utils/image-validator.js';
import { requireAuth } from 'allo-scrapper-server/dist/middleware/auth.js';
import { requirePermission } from 'allo-scrapper-server/dist/middleware/permission.js';
import type { PermissionName } from 'allo-scrapper-server/dist/types/role.js';

const router = Router();

const VALID_SCRAPE_MODES = ['weekly', 'from_today', 'from_today_limited'];
const SCRAPE_DAYS_MIN = 1;
const SCRAPE_DAYS_MAX = 14;
const LOGO_MAX_SIZE = 200000;
const FAVICON_MAX_SIZE = 50000;

const INPUT_LIMITS = {
  site_name: 100,
  footer_text: 500,
  email_from_name: 100,
  email_from_address: 255,
  font_primary: 100,
  font_secondary: 100,
} as const;

const DEFAULT_THEME_SETTINGS = {
  color_accent: '#F59E0B',
  color_background: '#FFFFFF',
  color_surface: '#F3F4F6',
  color_text_primary: '#111827',
  color_text_secondary: '#6B7280',
  color_success: '#10B981',
  color_error: '#EF4444',
} as const;

const DEFAULT_PUBLIC_EXPORT_USER = 'org-admin';
const REQUIRED_IMPORT_FIELDS = [
  'site_name',
  'color_primary',
  'color_secondary',
  'color_accent',
  'color_background',
  'color_surface',
  'color_text_primary',
  'color_text_secondary',
  'color_success',
  'color_error',
  'font_primary',
  'font_secondary',
  'email_from_name',
  'email_from_address',
] as const;

type ExportableOrgSettings = Awaited<ReturnType<OrgSettingsService['getSettings']>>;

type ThemeCssSettings = OrgSettingsPublic & {
  color_accent: string;
  color_background: string;
  color_surface: string;
  color_text_primary: string;
  color_text_secondary: string;
  color_success: string;
  color_error: string;
};

function normalizeFooterLinks(
  footerLinks: FooterLink[] | undefined
): Array<{ label: string; text: string; url: string }> {
  if (!Array.isArray(footerLinks)) {
    return [];
  }

  return footerLinks.map((link) => {
    const label = link.label ?? link.text ?? '';

    return {
      label,
      text: label,
      url: link.url,
    };
  });
}

function validateImportPayload(importData: { version?: string; settings?: Record<string, unknown> }): string | null {
  if (!importData.version || !importData.settings || typeof importData.settings !== 'object') {
    return 'Invalid import data format';
  }

  if (importData.version !== '1.0') {
    return `Incompatible version: ${importData.version}. Expected 1.0`;
  }

  return null;
}

function validateRequiredImportSettings(updates: OrgSettingsUpdate): string | null {
  for (const field of REQUIRED_IMPORT_FIELDS) {
    if (!(field in updates)) {
      return `Missing required field in import data: ${field}`;
    }
  }

  return null;
}

function toThemeCssSettings(settings: OrgSettingsPublic): ThemeCssSettings {
  return {
    ...settings,
    color_accent: settings.color_accent ?? DEFAULT_THEME_SETTINGS.color_accent,
    color_background: settings.color_background ?? DEFAULT_THEME_SETTINGS.color_background,
    color_surface: settings.color_surface ?? DEFAULT_THEME_SETTINGS.color_surface,
    color_text_primary: settings.color_text_primary ?? DEFAULT_THEME_SETTINGS.color_text_primary,
    color_text_secondary:
      settings.color_text_secondary ?? DEFAULT_THEME_SETTINGS.color_text_secondary,
    color_success: settings.color_success ?? DEFAULT_THEME_SETTINGS.color_success,
    color_error: settings.color_error ?? DEFAULT_THEME_SETTINGS.color_error,
  };
}

function toExportPayload(
  settings: NonNullable<ExportableOrgSettings>,
  user: { username?: string } | undefined,
) {
  const exportableSettings = {
    ...settings,
    footer_links: normalizeFooterLinks(settings.footer_links),
  };

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    exported_by: user?.username ?? DEFAULT_PUBLIC_EXPORT_USER,
    settings: exportableSettings,
  };
}

export function normalizeImportSettings(rawSettings: Record<string, unknown>): OrgSettingsUpdate {
  const normalizedFooterLinks = Array.isArray(rawSettings.footer_links)
    ? rawSettings.footer_links.map((link) => {
        const item = typeof link === 'object' && link !== null
          ? (link as Record<string, unknown>)
          : {};

        const label = item.label ?? item.text;
        const url = item.url;

        return {
          label: typeof label === 'string' ? label : '',
          url: typeof url === 'string' ? url : '',
        };
      })
    : rawSettings.footer_links === null
      ? null as never
      : undefined;

  const updates: OrgSettingsUpdate = {
    site_name: typeof rawSettings.site_name === 'string' ? rawSettings.site_name : undefined,
    logo_base64:
      typeof rawSettings.logo_base64 === 'string' || rawSettings.logo_base64 === null
        ? (rawSettings.logo_base64 as string | null | undefined)
        : undefined,
    favicon_base64:
      typeof rawSettings.favicon_base64 === 'string' || rawSettings.favicon_base64 === null
        ? (rawSettings.favicon_base64 as string | null | undefined)
        : undefined,
    color_primary:
      typeof rawSettings.color_primary === 'string' ? rawSettings.color_primary : undefined,
    color_secondary:
      typeof rawSettings.color_secondary === 'string' ? rawSettings.color_secondary : undefined,
    color_accent:
      typeof rawSettings.color_accent === 'string' ? rawSettings.color_accent : undefined,
    color_background:
      typeof rawSettings.color_background === 'string' ? rawSettings.color_background : undefined,
    color_surface:
      typeof rawSettings.color_surface === 'string'
        ? rawSettings.color_surface
        : typeof rawSettings.color_border === 'string'
          ? rawSettings.color_border
          : undefined,
    color_text_primary:
      typeof rawSettings.color_text_primary === 'string'
        ? rawSettings.color_text_primary
        : typeof rawSettings.color_text === 'string'
          ? rawSettings.color_text
          : undefined,
    color_text_secondary:
      typeof rawSettings.color_text_secondary === 'string'
        ? rawSettings.color_text_secondary
        : undefined,
    color_success:
      typeof rawSettings.color_success === 'string' ? rawSettings.color_success : undefined,
    color_error:
      typeof rawSettings.color_error === 'string' ? rawSettings.color_error : undefined,
    font_primary:
      typeof rawSettings.font_primary === 'string'
        ? rawSettings.font_primary
        : typeof rawSettings.font_family_heading === 'string'
          ? rawSettings.font_family_heading
          : undefined,
    font_secondary:
      typeof rawSettings.font_secondary === 'string'
        ? rawSettings.font_secondary
        : typeof rawSettings.font_family_body === 'string'
          ? rawSettings.font_family_body
          : undefined,
    footer_text:
      typeof rawSettings.footer_text === 'string' || rawSettings.footer_text === null
        ? (rawSettings.footer_text as string | null | undefined)
        : undefined,
    footer_links: normalizedFooterLinks,
    email_from_name:
      typeof rawSettings.email_from_name === 'string' ? rawSettings.email_from_name : undefined,
    email_from_address:
      typeof rawSettings.email_from_address === 'string'
        ? rawSettings.email_from_address
        : undefined,
    scrape_mode: rawSettings.scrape_mode as OrgSettingsUpdate['scrape_mode'] | undefined,
    scrape_days:
      typeof rawSettings.scrape_days === 'number' ? rawSettings.scrape_days : undefined,
  };

  return Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  ) as OrgSettingsUpdate;
}

async function validateSettingsImages(res: Response, updates: OrgSettingsUpdate): Promise<boolean> {
  if (updates.logo_base64) {
    const logoValidation = await validateImage(updates.logo_base64, 'logo', LOGO_MAX_SIZE);
    if (!logoValidation.valid) {
      res.status(400).json({ error: `Invalid logo: ${logoValidation.error}` });
      return false;
    }
    updates.logo_base64 = logoValidation.compressedBase64!;
  }

  if (updates.favicon_base64) {
    const faviconValidation = await validateImage(updates.favicon_base64, 'favicon', FAVICON_MAX_SIZE);
    if (!faviconValidation.valid) {
      res.status(400).json({ error: `Invalid favicon: ${faviconValidation.error}` });
      return false;
    }
    updates.favicon_base64 = faviconValidation.compressedBase64!;
  }

  return true;
}

function validateSettingsUpdate(res: Response, updates: OrgSettingsUpdate): boolean {
  for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
    const value = updates[field as keyof OrgSettingsUpdate];
    if (typeof value === 'string' && value.length > limit) {
      res.status(400).json({
        error: `${field} exceeds maximum length of ${limit} characters`,
      });
      return false;
    }
  }

  const colorFields: Array<keyof OrgSettingsUpdate> = [
    'color_primary',
    'color_secondary',
    'color_accent',
    'color_background',
    'color_surface',
    'color_text_primary',
    'color_text_secondary',
    'color_success',
    'color_error',
  ];

  for (const field of colorFields) {
    const value = updates[field];
    if (value !== undefined && (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value))) {
      res.status(400).json({
        error: `${field} must be a valid hex color in the format #RRGGBB`,
      });
      return false;
    }
  }

  if (updates.font_primary !== undefined && !isValidThemeFontValue(updates.font_primary)) {
    res.status(400).json({
      error: 'font_primary must be a supported system font or Google Font',
    });
    return false;
  }

  if (updates.font_secondary !== undefined && !isValidThemeFontValue(updates.font_secondary)) {
    res.status(400).json({
      error: 'font_secondary must be a supported system font or Google Font',
    });
    return false;
  }

  if (updates.footer_links !== undefined) {
    if (!Array.isArray(updates.footer_links)) {
      res.status(400).json({ error: 'footer_links must be an array' });
      return false;
    }

    for (const link of updates.footer_links) {
      if (!link || typeof link !== 'object') {
        res.status(400).json({ error: 'Each footer link must be an object with label and url' });
        return false;
      }

      if (typeof link.label !== 'string' || link.label.trim() === '') {
        res.status(400).json({ error: 'Each footer link must include a non-empty label' });
        return false;
      }

      if (typeof link.url !== 'string' || link.url.trim() === '') {
        res.status(400).json({ error: 'Each footer link must include a non-empty url' });
        return false;
      }

      try {
        const parsedUrl = new URL(link.url, 'http://dummy.com');
        if (
          parsedUrl.protocol !== 'http:'
          && parsedUrl.protocol !== 'https:'
          && parsedUrl.protocol !== 'mailto:'
          && parsedUrl.protocol !== 'tel:'
        ) {
          res.status(400).json({
            error: `Invalid URL protocol in footer link: ${link.url}`,
          });
          return false;
        }
      } catch {
        res.status(400).json({
          error: `Invalid URL format in footer link: ${link.url}`,
        });
        return false;
      }
    }
  }

  if (updates.scrape_mode !== undefined && !VALID_SCRAPE_MODES.includes(updates.scrape_mode)) {
    res.status(400).json({
      error: `Invalid scrape_mode: must be one of ${VALID_SCRAPE_MODES.join(', ')}`,
    });
    return false;
  }

  if (updates.scrape_days !== undefined) {
    const days = updates.scrape_days;
    if (!Number.isInteger(days) || days < SCRAPE_DAYS_MIN || days > SCRAPE_DAYS_MAX) {
      res.status(400).json({
        error: `Invalid scrape_days: must be an integer between ${SCRAPE_DAYS_MIN} and ${SCRAPE_DAYS_MAX}`,
      });
      return false;
    }
  }

  return true;
}

async function updateSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = req.dbClient as unknown as DB;

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const updates: OrgSettingsUpdate = req.body;
    const user = (req as any).user as { id: number } | undefined;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!await validateSettingsImages(res, updates)) {
      return;
    }

    if (!validateSettingsUpdate(res, updates)) {
      return;
    }

    const service = new OrgSettingsService(db);
    const updatedSettings = await service.updateSettings(updates, user.id);

    if (!updatedSettings) {
      res.status(500).json({ error: 'Failed to update settings' });
      return;
    }

    res.json({ success: true, data: updatedSettings });
  } catch (error) {
    next(error);
  }
}

const PERM_SETTINGS_READ: PermissionName    = 'settings:read';
const PERM_SETTINGS_UPDATE: PermissionName  = 'settings:update';
const PERM_SETTINGS_EXPORT: PermissionName  = 'settings:export';
const PERM_SETTINGS_IMPORT: PermissionName  = 'settings:import';
const PERM_SETTINGS_RESET: PermissionName   = 'settings:reset';

const requireSettingsRead = [requireAuth as any, requirePermission(PERM_SETTINGS_READ) as any] as const;
const requireSettingsUpdate = [requireAuth as any, requirePermission(PERM_SETTINGS_UPDATE) as any] as const;
const requireSettingsExport = [requireAuth as any, requirePermission(PERM_SETTINGS_EXPORT) as any] as const;
const requireSettingsImport = [requireAuth as any, requirePermission(PERM_SETTINGS_IMPORT) as any] as const;
const requireSettingsReset = [requireAuth as any, requirePermission(PERM_SETTINGS_RESET) as any] as const;

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const service = new OrgSettingsService(db);
    const settings = await service.getPublicSettings();

    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.get('/admin', ...requireSettingsRead, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const service = new OrgSettingsService(db);
    const settings = await service.getSettings();

    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.put('/', ...requireSettingsUpdate, updateSettingsHandler);
router.put('/admin', ...requireSettingsUpdate, updateSettingsHandler);

router.post('/export', ...requireSettingsExport, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const user = (req as any).user as { username?: string } | undefined;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const service = new OrgSettingsService(db);
    const settings = await service.getSettings();

    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    res.json({
      success: true,
      data: toExportPayload(settings, user),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/import', ...requireSettingsImport, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const user = (req as any).user as { id: number } | undefined;
    const importData = req.body as { version?: string; settings?: Record<string, unknown> };

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const importValidationError = validateImportPayload(importData);
    if (importValidationError) {
      res.status(400).json({ error: importValidationError });
      return;
    }

    const updates = normalizeImportSettings(importData.settings!);
    const requiredImportSettingsError = validateRequiredImportSettings(updates);
    if (requiredImportSettingsError) {
      res.status(400).json({ error: requiredImportSettingsError });
      return;
    }

    if (!await validateSettingsImages(res, updates)) {
      return;
    }

    if (!validateSettingsUpdate(res, updates)) {
      return;
    }

    const service = new OrgSettingsService(db);
    const updatedSettings = await service.updateSettings(updates, user.id);

    if (!updatedSettings) {
      res.status(500).json({ error: 'Failed to import settings' });
      return;
    }

    res.json({ success: true, data: updatedSettings });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/reset', ...requireSettingsReset, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const user = (req as any).user as { id: number } | undefined;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const service = new OrgSettingsService(db);
    const defaultSettings = await service.resetSettings(user.id);

    if (!defaultSettings) {
      res.status(500).json({ error: 'Failed to reset settings' });
      return;
    }

    res.json({ success: true, data: defaultSettings });
  } catch (error) {
    next(error);
  }
});

router.get('/theme.css', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const service = new OrgSettingsService(db);
    const publicSettings = await service.getPublicSettings();

    if (!publicSettings) {
      res.status(404).send('/* Settings not found */');
      return;
    }

    const themeSettings = toThemeCssSettings(publicSettings);
    const googleFonts = [
      extractSupportedGoogleFont(themeSettings.font_primary),
      extractSupportedGoogleFont(themeSettings.font_secondary),
    ].filter((font): font is string => Boolean(font));

    const parts: string[] = [
      `/* Auto-generated theme CSS for ${themeSettings.site_name} */`,
      '@charset "UTF-8";',
      '',
    ];

    const fontsImport = generateGoogleFontsImport(googleFonts);
    if (fontsImport) {
      parts.push(fontsImport);
    }

    parts.push(generateCSSVariables(themeSettings));

    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(parts.join('\n'));
  } catch (error) {
    next(error);
  }
});

export default router;
