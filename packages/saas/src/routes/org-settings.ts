import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import { OrgSettingsService } from '../services/org-settings-service.js';
import type { OrgSettingsUpdate, OrgSettingsExport, ScrapeMode } from '../services/org-settings-service.js';

// ── Minimal inline types (avoids cross-package rootDir violation) ─────────────

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Minimal user shape attached by requireAuth */
interface AuthUser {
  id: number;
  username: string;
  role_name: string;
  is_system_role: boolean;
  permissions: string[];
  org_id?: string;
  org_slug?: string;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

/** Minimal image validation result */
interface ImageValidationResult {
  valid: boolean;
  error?: string;
  compressedBase64?: string;
}

// ── Injectable middleware types ───────────────────────────────────────────────

type AuthMiddleware = RequestHandler;
type PermissionMiddlewareFactory = (permission: string) => RequestHandler;
type ImageValidator = (
  data: string,
  type: 'logo' | 'favicon',
  maxBytes: number,
) => Promise<ImageValidationResult>;
type ErrorFactory = (message: string) => Error & { statusCode?: number };

/** Dependencies injected by the caller (allows full decoupling from server pkg) */
export interface OrgSettingsRouterDeps {
  requireAuth: AuthMiddleware;
  requirePermission: PermissionMiddlewareFactory;
  protectedLimiter: AuthMiddleware;
  validateImage: ImageValidator;
  /** Factory that produces a 404 error */
  notFoundError: ErrorFactory;
  /** Factory that produces a 400 validation error */
  validationError: ErrorFactory;
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOGO_MAX_SIZE = 200000; // 200 KB
const FAVICON_MAX_SIZE = 50000; // 50 KB

const VALID_SCRAPE_MODES: ScrapeMode[] = ['weekly', 'from_today', 'from_today_limited'];
const SCRAPE_DAYS_MIN = 1;
const SCRAPE_DAYS_MAX = 14;

const INPUT_LIMITS: Record<string, number> = {
  site_name: 100,
  footer_text: 500,
  email_from_name: 100,
  email_from_address: 255,
  font_primary: 100,
  font_secondary: 100,
};

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates the settings sub-router for an org.
 * Mounted at /api/org/:slug/settings by createOrgRouter().
 * Assumes resolveTenant middleware has already run (req.org and req.dbClient set).
 *
 * All server-specific dependencies are injected so this router stays within
 * the saas package's rootDir and can be unit-tested in isolation.
 */
export function createOrgSettingsRouter(deps: OrgSettingsRouterDeps): Router {
  const {
    requireAuth,
    requirePermission,
    protectedLimiter,
    validateImage,
    notFoundError,
    validationError,
    logger,
  } = deps;

  const router = Router({ mergeParams: true });

  // ── GET /settings (public) ─────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const svc = new OrgSettingsService(req.dbClient!);
      const settings = await svc.getPublicSettings();

      if (!settings) {
        return next(notFoundError('Settings not found'));
      }

      const response: ApiResponse = { success: true, data: settings };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // ── GET /settings/admin (auth required) ────────────────────────────────────
  router.get(
    '/admin',
    protectedLimiter,
    requireAuth,
    requirePermission('settings:read'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const svc = new OrgSettingsService(req.dbClient!);
        const settings = await svc.getSettings();

        if (!settings) {
          return next(notFoundError('Settings not found'));
        }

        const response: ApiResponse = { success: true, data: settings };
        res.json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  // ── PUT /settings (auth required) ─────────────────────────────────────────
  router.put(
    '/',
    protectedLimiter,
    requireAuth,
    requirePermission('settings:update'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthRequest;
        const updates: OrgSettingsUpdate = req.body;

        // Validate logo
        if (updates.logo_base64) {
          const logoValidation = await validateImage(updates.logo_base64, 'logo', LOGO_MAX_SIZE);
          if (!logoValidation.valid) {
            return next(validationError(`Invalid logo: ${logoValidation.error}`));
          }
          updates.logo_base64 = logoValidation.compressedBase64!;
        }

        // Validate favicon
        if (updates.favicon_base64) {
          const faviconValidation = await validateImage(
            updates.favicon_base64,
            'favicon',
            FAVICON_MAX_SIZE,
          );
          if (!faviconValidation.valid) {
            return next(validationError(`Invalid favicon: ${faviconValidation.error}`));
          }
          updates.favicon_base64 = faviconValidation.compressedBase64!;
        }

        // Validate text field lengths
        for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
          const value = updates[field as keyof OrgSettingsUpdate];
          if (typeof value === 'string' && value.length > limit) {
            return next(
              validationError(`${field} exceeds maximum length of ${limit} characters`),
            );
          }
        }

        // Validate footer links — prevent stored XSS via javascript: / data: URIs
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
                  return next(
                    validationError(`Invalid URL protocol in footer link: ${link.url}`),
                  );
                }
              } catch {
                return next(
                  validationError(`Invalid URL format in footer link: ${link.url}`),
                );
              }
            }
          }
        }

        // Validate scrape_mode
        if (updates.scrape_mode !== undefined) {
          if (!VALID_SCRAPE_MODES.includes(updates.scrape_mode)) {
            return next(
              validationError(
                `Invalid scrape_mode: must be one of ${VALID_SCRAPE_MODES.join(', ')}`,
              ),
            );
          }
        }

        // Validate scrape_days
        if (updates.scrape_days !== undefined) {
          const days = updates.scrape_days;
          if (!Number.isInteger(days) || days < SCRAPE_DAYS_MIN || days > SCRAPE_DAYS_MAX) {
            return next(
              validationError(
                `Invalid scrape_days: must be an integer between ${SCRAPE_DAYS_MIN} and ${SCRAPE_DAYS_MAX}`,
              ),
            );
          }
        }

        const svc = new OrgSettingsService(req.dbClient!);
        const updatedSettings = await svc.updateSettings(updates, authReq.user!.id);

        if (!updatedSettings) {
          return next(new Error('Failed to update settings'));
        }

        logger.info(`Org settings updated by user ${authReq.user!.username}`, {
          orgSlug: req.org?.slug,
          userId: authReq.user!.id,
          updatedFields: Object.keys(updates),
        });

        const response: ApiResponse = { success: true, data: updatedSettings };
        res.json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  // ── POST /settings/reset ───────────────────────────────────────────────────
  router.post(
    '/reset',
    protectedLimiter,
    requireAuth,
    requirePermission('settings:reset'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthRequest;
        const svc = new OrgSettingsService(req.dbClient!);
        const defaultSettings = await svc.resetSettings(authReq.user!.id);

        if (!defaultSettings) {
          return next(new Error('Failed to reset settings'));
        }

        logger.info(`Org settings reset to defaults by user ${authReq.user!.username}`, {
          orgSlug: req.org?.slug,
          userId: authReq.user!.id,
        });

        const response: ApiResponse = { success: true, data: defaultSettings };
        res.json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  // ── POST /settings/export ──────────────────────────────────────────────────
  router.post(
    '/export',
    protectedLimiter,
    requireAuth,
    requirePermission('settings:export'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthRequest;
        const svc = new OrgSettingsService(req.dbClient!);
        const exportData = await svc.exportSettings();

        if (!exportData) {
          return next(notFoundError('No settings to export'));
        }

        logger.info('Org settings exported', {
          orgSlug: req.org?.slug,
          userId: authReq.user!.id,
        });

        const response: ApiResponse = { success: true, data: exportData };
        res.json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  // ── POST /settings/import ──────────────────────────────────────────────────
  router.post(
    '/import',
    protectedLimiter,
    requireAuth,
    requirePermission('settings:import'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthRequest;
        const importData: OrgSettingsExport = req.body;

        // Basic structure check before delegating to service
        if (!importData.version || !importData.settings) {
          return next(validationError('Invalid import data format'));
        }

        const svc = new OrgSettingsService(req.dbClient!);
        const importedSettings = await svc.importSettings(importData, authReq.user!.id);

        if (!importedSettings) {
          return next(new Error('Failed to import settings'));
        }

        logger.info(`Org settings imported by user ${authReq.user!.username}`, {
          orgSlug: req.org?.slug,
          userId: authReq.user!.id,
          version: importData.version,
        });

        const response: ApiResponse = { success: true, data: importedSettings };
        res.json(response);
      } catch (error) {
        return next(error instanceof Error ? validationError(error.message) : error);
      }
    },
  );

  return router;
}
