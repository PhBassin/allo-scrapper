/**
 * Registration and slug availability routes.
 *
 * POST /api/saas/orgs          — create a new organisation
 * GET  /api/saas/orgs/:slug/available — check slug availability
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isSlugAvailable } from '../db/org-queries.js';
import { createOrg } from '../services/org-service.js';
import { SaasAuthService } from '../services/saas-auth-service.js';
import { EmailService } from '../services/email-service.js';
import type { DB, Pool } from '../db/types.js';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Rate limit: 5 org-creation attempts per 15 minutes per IP */
const orgCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_SAAS_ORG_MAX'] ?? '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts, please try again later.' },
});

export function createRegisterRouter(): Router {
  const router = Router();

  /**
   * POST /api/saas/orgs
   * Creates a new organization with its dedicated PostgreSQL schema,
   * provisions the admin user inside that schema, and returns a JWT.
   *
   * Body: { orgName, slug, adminEmail, adminPassword }
   */
  router.post('/saas/orgs', orgCreationLimiter, async (req, res) => {
    const { orgName, slug, adminEmail, adminPassword } = req.body as Record<string, string>;

    const errors: string[] = [];
    if (!orgName || orgName.trim().length < 2)
      errors.push('orgName must be at least 2 characters');
    if (!slug || !SLUG_PATTERN.test(slug))
      errors.push('slug must be 3-30 chars, lowercase alphanumeric and hyphens');
    if (!adminEmail || !adminEmail.includes('@'))
      errors.push('adminEmail must be a valid email');
    if (!adminPassword || adminPassword.length < 8)
      errors.push('adminPassword must be at least 8 characters');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const db = req.app.get('db') as DB;
    const pool = req.app.get('pool') as Pool;

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

    // Create admin user in the org's private schema and mint JWT
    const authService = new SaasAuthService(pool);
    const adminUser = await authService.createAdminUser(org, adminEmail, adminPassword);
    const token = authService.mintJwt({
      userId: adminUser.id,
      username: adminUser.username,
      orgId: org.id,
      orgSlug: org.slug,
      roleId: adminUser.role_id,
      roleName: adminUser.role_name,
      permissions: [], // Phase 3: load from org schema permissions table
    });

    // Dispatch verification email non-blocking (fire-and-forget)
    const emailService = new EmailService(db);
    const verificationToken = emailService.generateVerificationToken();
    const prefixedToken = `${org.slug}:${verificationToken}`;
    emailService.storeVerificationToken(org, adminUser.id, prefixedToken).then(() =>
      emailService.sendVerificationEmail(adminEmail, prefixedToken, org.slug)
    ).catch((err: unknown) => {
      console.error('[register] Failed to send verification email:', err);
    });

    return res.status(201).json({
      success: true,
      token,
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        role_id: adminUser.role_id,
        role_name: adminUser.role_name,
      },
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
   * GET /api/saas/orgs/:slug/available
   * Quick slug availability check (public, no auth).
   */
  router.get('/saas/orgs/:slug/available', async (req, res) => {
    const slug = req.params['slug'];
    if (!SLUG_PATTERN.test(slug)) {
      return res.status(400).json({ success: false, available: false, error: 'Invalid slug format' });
    }
    const db = req.app.get('db') as DB;
    const available = await isSlugAvailable(db, slug);
    return res.json({ success: true, available });
  });

  return router;
}
