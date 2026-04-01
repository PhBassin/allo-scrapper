import type { Request, Response, NextFunction } from 'express';
import { Counter, Registry } from 'prom-client';

// ── Per-org Prometheus registry ───────────────────────────────────────────────

const orgRegistry = new Registry();

const orgHttpRequestsTotal = new Counter({
  name: 'saas_org_http_requests_total',
  help: 'Total HTTP requests per org, method, and status code',
  labelNames: ['org_slug', 'method', 'status_code'] as const,
  registers: [orgRegistry],
});

/**
 * Returns the per-org Prometheus registry.
 * Expose via GET /api/org/:slug/metrics (or aggregate in the scraper).
 */
export function getOrgRegistry(): Registry {
  return orgRegistry;
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Express middleware that increments a Prometheus counter for every request.
 * Labels: org_slug (from req.org, if present), method, status_code.
 *
 * Works in both SaaS (tenant-resolved) and standalone routes:
 * - If req.org is absent, org_slug is recorded as "unknown".
 */
export function createOrgMetricsMiddleware() {
  return function orgMetrics(req: Request, res: Response, next: NextFunction): void {
    // Hook into the finish event to capture final status code
    res.on('finish', () => {
      const org = (req as Request & { org?: { slug: string } }).org;
      orgHttpRequestsTotal.inc({
        org_slug: org?.slug ?? 'unknown',
        method: req.method,
        status_code: String(res.statusCode),
      });
    });

    next();
  };
}
