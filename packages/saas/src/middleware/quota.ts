import type { Request, Response, NextFunction } from 'express';
import { getPlanById } from '../db/org-queries.js';
import { QuotaService, type QuotaResource } from '../services/quota-service.js';
import type { DB } from '../db/types.js';
import type { Organization } from '../db/org-queries.js';

/** Maps a quota resource to the plan limit column and usage counter key. */
const RESOURCE_MAP: Record<
  QuotaResource,
  { planKey: 'max_cinemas' | 'max_users' | 'max_scrapes_per_month'; usageKey: string }
> = {
  cinemas: { planKey: 'max_cinemas',           usageKey: 'cinemas_count' },
  users:   { planKey: 'max_users',             usageKey: 'users_count'   },
  scrapes: { planKey: 'max_scrapes_per_month', usageKey: 'scrapes_count' },
};

/**
 * Express middleware factory that enforces plan quotas.
 *
 * Usage:
 *   router.post('/cinemas', requireAuth, checkQuota('cinemas'), createCinema);
 *
 * Reads req.org (set by resolveTenant) and req.app.get('db').
 * Returns 402 QUOTA_EXCEEDED when the org has reached its plan limit.
 * Returns 500 if the plan record is not found.
 * Passes through (calls next()) when under the limit or when the limit is null (unlimited).
 */
export function checkQuota(resource: QuotaResource) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const org = (req as any).org as Organization | undefined;
    if (!org) {
      res.status(500).json({ error: 'Tenant not resolved' });
      return;
    }

    const db = req.app.get('db') as DB;

    const plan = await getPlanById(db, org.plan_id);
    if (!plan) {
      res.status(500).json({ error: 'Plan not found' });
      return;
    }

    const { planKey, usageKey } = RESOURCE_MAP[resource];
    const limit = plan[planKey] as number | null;

    // null = unlimited — always allow
    if (limit === null) {
      next();
      return;
    }

    const quotaService = new QuotaService(db);
    const usage = await quotaService.getOrCreateUsage(org.id);
    const current = (usage as unknown as Record<string, number>)[usageKey];

    if (current >= limit) {
      res.status(402).json({
        error: 'QUOTA_EXCEEDED',
        resource,
        limit,
        current,
        upgrade_url: `/api/org/${org.slug}/billing/checkout`,
      });
      return;
    }

    next();
  };
}
