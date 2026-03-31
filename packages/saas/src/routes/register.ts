import { Router, type Request, type Response } from 'express';
import { isSlugAvailable } from '../db/org-queries.js';
import { createOrg } from '../services/org-service.js';
import type { DB } from '../db/types.js';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function createRegisterRouter(): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   * Creates a new organization with its dedicated PostgreSQL schema.
   *
   * Body: { orgName, slug, adminEmail, adminPassword }
   */
  router.post('/register', async (req: Request, res: Response) => {
    const { orgName, slug, adminEmail, adminPassword } = req.body as Record<string, string>;

    // Basic validation
    const errors: string[] = [];
    if (!orgName || orgName.trim().length < 2) errors.push('orgName must be at least 2 characters');
    if (!slug || !SLUG_PATTERN.test(slug)) errors.push('slug must be 3-30 chars, lowercase alphanumeric and hyphens');
    if (!adminEmail || !adminEmail.includes('@')) errors.push('adminEmail must be a valid email');
    if (!adminPassword || adminPassword.length < 8) errors.push('adminPassword must be at least 8 characters');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const db = req.app.get('db') as DB;

    // Check slug availability before attempting creation
    const slugFree = await isSlugAvailable(db, slug);
    if (!slugFree) {
      return res.status(409).json({ success: false, errors: [`Slug "${slug}" is already taken`] });
    }

    // Create org + schema + bootstrap tables
    const { org } = await createOrg(db, {
      name: orgName.trim(),
      slug,
      plan_id: 1, // Free plan by default
    });

    // TODO (Phase 5): create admin user in org schema + return JWT

    return res.status(201).json({
      success: true,
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        schema_name: org.schema_name,
        status: org.status,
        trial_ends_at: org.trial_ends_at,
      },
    });
  });

  /**
   * GET /api/orgs/:slug/available
   * Quick slug availability check (public, no auth).
   */
  router.get('/orgs/:slug/available', async (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!SLUG_PATTERN.test(slug)) {
      return res.status(400).json({ success: false, available: false, error: 'Invalid slug format' });
    }
    const db = req.app.get('db') as DB;
    const available = await isSlugAvailable(db, slug);
    return res.json({ success: true, available });
  });

  return router;
}
