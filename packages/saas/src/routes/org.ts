import { Router, type Request, type Response } from 'express';
import { resolveTenant } from '../middleware/tenant.js';

/**
 * All routes under /api/org/:slug/* use the resolveTenant middleware,
 * which sets req.org and req.dbClient (pg client with search_path scoped to org schema).
 *
 * Route handlers should use req.dbClient instead of req.app.get('db')
 * to benefit from the schema isolation.
 */
export function createOrgRouter(): Router {
  const router = Router({ mergeParams: true });

  // Apply tenant resolution to all org routes
  router.use(resolveTenant);

  // TODO Phase 5: re-mount core resource routes under org context
  // e.g. cinemas, showtimes, reports, settings, users, scraper

  // Temporary health check to verify tenant resolution
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

  return router;
}
