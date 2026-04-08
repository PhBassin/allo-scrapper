/**
 * Prometheus metrics middleware for multi-tenant observability.
 * Tracks requests per organization with labels.
 */
import { Registry, Counter } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

// Create a separate registry for org metrics (separate from server metrics)
const orgRegistry = new Registry();

// Counter for org requests
const orgRequestsTotal = new Counter({
  name: 'saas_org_requests_total',
  help: 'Total HTTP requests per organization',
  labelNames: ['org_slug', 'method', 'route', 'status'],
  registers: [orgRegistry],
});

/**
 * Middleware to track org-level metrics.
 * Increments counters when response finishes.
 */
export function createOrgMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Capture start time for duration
    const startTime = Date.now();

    // Intercept res.on('finish') to record metrics
    res.on('finish', () => {
      try {
        const org = (req as any).org;
        const orgSlug = org?.slug ?? 'unknown';
        const method = req.method;
        const route = req.route?.path ?? req.path;
        const status = String(res.statusCode);

        orgRequestsTotal.inc({
          org_slug: orgSlug,
          method,
          route,
          status,
        });
      } catch (error) {
        console.error('Org metrics error:', error);
      }
    });

    next();
  };
}

/**
 * Get the org metrics registry for exposing at /api/saas/metrics
 */
export function getOrgRegistry(): Registry {
  return orgRegistry;
}
