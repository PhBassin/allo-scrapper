import { Router, type Request, type Response } from 'express';
import { resolveTenant } from '../middleware/tenant.js';
import { checkQuota } from '../middleware/quota.js';
import { createOrgSettingsRouter, type OrgSettingsRouterDeps } from './org-settings.js';

/**
 * All routes under /api/org/:slug/* use the resolveTenant middleware,
 * which sets req.org and scopes the DB connection to the org schema.
 *
 * Quota enforcement is applied via checkQuota('resource') before any
 * write operation that creates cinemas, users, or triggers scrapes.
 *
 * @param settingsDeps - Injected server-side dependencies for the settings router.
 *   Passed in from plugin.ts at registration time so the saas package
 *   itself does not need to cross the rootDir boundary at compile time.
 */
export function createOrgRouter(settingsDeps: OrgSettingsRouterDeps): Router {
  const router = Router({ mergeParams: true });

  // Apply tenant resolution to all org routes
  router.use(resolveTenant);

  // ── Health / ping ──────────────────────────────────────────────────────────
  router.get('/ping', (req: Request, res: Response) => {
    res.json({
      success: true,
      org: {
        id: req.org!.id,
        slug: req.org!.slug,
        name: req.org!.name,
        status: req.org!.status,
      },
    });
  });

  // ── Cinemas ────────────────────────────────────────────────────────────────
  // POST /api/org/:slug/cinemas — quota-guarded cinema creation
  // Full implementation in Phase 5 (core route re-mount under org context)
  router.post('/cinemas', checkQuota('cinemas'), (_req: Request, res: Response) => {
    res.status(501).json({ success: false, error: 'Not implemented — Phase 5' });
  });

  // ── Users / invitations ────────────────────────────────────────────────────
  // POST /api/org/:slug/users — quota-guarded user creation (direct, no invite)
  router.post('/users', checkQuota('users'), (_req: Request, res: Response) => {
    res.status(501).json({ success: false, error: 'Not implemented — Phase 5' });
  });

  // ── Scrape trigger ─────────────────────────────────────────────────────────
  // POST /api/org/:slug/scrape — quota-guarded scrape trigger
  router.post('/scrape', checkQuota('scrapes'), (_req: Request, res: Response) => {
    res.status(501).json({ success: false, error: 'Not implemented — Phase 5' });
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  // GET/PUT /api/org/:slug/settings, /settings/admin, /settings/reset, etc.
  router.use('/settings', createOrgSettingsRouter(settingsDeps));

  return router;
}
