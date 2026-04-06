/**
 * Express middleware factory that enforces plan quotas.
 *
 * Usage:
 *   router.post('/cinemas', requireAuth, checkQuota('cinemas'), createCinema);
 *
 * Reads req.org and req.dbClient (both set by resolveTenant).
 * Returns 402 QUOTA_EXCEEDED when the org has reached its plan limit.
 * Returns 500 if the plan record is not found.
 * Passes through (calls next()) when under the limit or when the limit is null (unlimited).
 */
import type { Request, Response, NextFunction } from 'express';
import { getPlanById } from '../db/org-queries.js';
import { QuotaService, type QuotaResource } from '../services/quota-service.js';
import type { DB } from '../db/types.js';
import type { Plan } from '../db/types.js';

/** Maps a quota resource to the plan limit column and usage counter key. */
const RESOURCE_MAP: Record<QuotaResource, { planKey: keyof Plan; usageKey: string }> = {
  cinemas: { planKey: 'max_cinemas', usageKey: 'cinemas_count' },
  users:   { planKey: 'max_users',   usageKey: 'users_count'   },
  scrapes: { planKey: 'max_scrapes_per_day', usageKey: 'scrapes_count' },
};

export function checkQuota(resource: QuotaResource) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const org = req.org;
    if (!org) {
      res.status(500).json({ error: 'Tenant not resolved' });
      return;
    }

    const db = req.dbClient as unknown as DB;
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
    const current = (usage as unknown as Record<string, number>)[usageKey] ?? 0;

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
