/**
 * Org-scoped routes.
 *
 * All routes are mounted under /api/org/:slug and go through resolveTenant.
 * For #739 only the /ping endpoint is implemented.
 */
import { Router } from 'express';
import { resolveTenant } from '../middleware/tenant.js';

export function createOrgRouter(): Router {
  const router = Router({ mergeParams: true });

  // Apply tenant resolution to all org routes
  router.use(resolveTenant);

  // ── Health / ping ──────────────────────────────────────────────────────────
  router.get('/ping', (req, res) => {
    res.json({
      success: true,
      org: {
        id: req.org.id,
        slug: req.org.slug,
        name: req.org.name,
        status: req.org.status,
      },
    });
  });

  return router;
}
