import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { requireSuperadmin } from '../middleware/superadmin-auth.js';
import { SuperadminAuthService } from '../services/superadmin-auth-service.js';
import type { Pool } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function getPool(req: Request): Pool {
  return req.app.get('pool') as Pool;
}

async function writeAuditLog(
  pool: Pool,
  actorId: number,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, targetType, targetId, JSON.stringify(metadata)],
    );
  } finally {
    client.release();
  }
}

async function getOrgById(pool: Pool, orgId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM organizations WHERE id = $1',
      [orgId],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function getOrgBySlug(pool: Pool, slug: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM organizations WHERE slug = $1',
      [slug],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

// ── Router factory ───────────────────────────────────────────────────────────

/**
 * Creates the superadmin router.
 *
 * Public routes (no auth):
 *   POST /api/superadmin/login
 *
 * Protected routes (require superadmin JWT):
 *   GET  /api/superadmin/dashboard
 *   GET  /api/superadmin/orgs
 *   GET  /api/superadmin/orgs/:id
 *   POST /api/superadmin/orgs/:id/suspend
 *   POST /api/superadmin/orgs/:id/reactivate
 *   PUT  /api/superadmin/orgs/:id/plan
 *   POST /api/superadmin/orgs/:id/reset-trial
 *   POST /api/superadmin/impersonate
 */
export function createSuperadminRouter(): Router {
  const router = Router();

  // ── POST /login ─────────────────────────────────────────────────────────────
  router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password are required' });
      return;
    }

    try {
      const pool = getPool(req);
      const service = new SuperadminAuthService(pool);

      const superadmin = await service.validateCredentials(username, password);
      if (!superadmin) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      const token = service.mintSuperadminJwt({
        superadminId: superadmin.id,
        username: superadmin.username,
      });

      res.json({ success: true, token });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ success: false, error: message });
    }
  });

  // ── All routes below require superadmin auth ─────────────────────────────
  router.use(requireSuperadmin);

  // ── GET /dashboard ─────────────────────────────────────────────────────────
  router.get('/dashboard', async (req: Request, res: Response) => {
    const pool = getPool(req);
    const client = await pool.connect();
    try {
      // Orgs grouped by status
      const orgsResult = await client.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count
           FROM organizations
          GROUP BY status`,
      );

      // New orgs this week
      const newOrgsResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM organizations
          WHERE created_at >= now() - interval '7 days'`,
      );

      // MRR: sum of monthly prices for active/trial orgs
      const mrrResult = await client.query<{ mrr_cents: string }>(
        `SELECT COALESCE(SUM(p.price_monthly_cents), 0)::text AS mrr_cents
           FROM organizations o
           JOIN plans p ON p.id = o.plan_id
          WHERE o.status IN ('active', 'trial')`,
      );

      const orgsByStatus = Object.fromEntries(
        orgsResult.rows.map((r) => [r.status, parseInt(r.count)]),
      );
      const mrrCents = parseInt(mrrResult.rows[0]?.mrr_cents ?? '0');

      res.json({
        success: true,
        data: {
          orgs: orgsByStatus,
          new_orgs_this_week: parseInt(newOrgsResult.rows[0]?.count ?? '0'),
          mrr_cents: mrrCents,
          arr_cents: mrrCents * 12,
        },
      });
    } finally {
      client.release();
    }
  });

  // ── GET /orgs ───────────────────────────────────────────────────────────────
  router.get('/orgs', async (req: Request, res: Response) => {
    const pool = getPool(req);
    const client = await pool.connect();
    try {
      const { status, search } = req.query as Record<string, string>;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (status) {
        conditions.push(`o.status = $${idx++}`);
        params.push(status);
      }
      if (search) {
        conditions.push(`(o.name ILIKE $${idx} OR o.slug ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await client.query(
        `SELECT o.*, p.name AS plan_name
           FROM organizations o
           JOIN plans p ON p.id = o.plan_id
           ${where}
          ORDER BY o.created_at DESC`,
        params,
      );

      res.json({ success: true, data: result.rows });
    } finally {
      client.release();
    }
  });

  // ── GET /orgs/:id ───────────────────────────────────────────────────────────
  router.get('/orgs/:id', async (req: Request, res: Response) => {
    const pool = getPool(req);
    const org = await getOrgById(pool, req.params.id);

    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    res.json({ success: true, data: org });
  });

  // ── POST /orgs/:id/suspend ──────────────────────────────────────────────────
  router.post('/orgs/:id/suspend', async (req: Request, res: Response) => {
    const pool = getPool(req);
    const org = await getOrgById(pool, req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    const client = await pool.connect();
    try {
      const updated = await client.query(
        `UPDATE organizations SET status = 'suspended', updated_at = now()
          WHERE id = $1 RETURNING *`,
        [org.id],
      );

      await writeAuditLog(pool, req.superadmin!.id, 'suspend_org', 'organization', org.id, {
        reason: req.body?.reason ?? null,
        previous_status: org.status,
      });

      res.json({ success: true, data: updated.rows[0] });
    } finally {
      client.release();
    }
  });

  // ── POST /orgs/:id/reactivate ───────────────────────────────────────────────
  router.post('/orgs/:id/reactivate', async (req: Request, res: Response) => {
    const pool = getPool(req);
    const org = await getOrgById(pool, req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    const client = await pool.connect();
    try {
      const updated = await client.query(
        `UPDATE organizations SET status = 'active', updated_at = now()
          WHERE id = $1 RETURNING *`,
        [org.id],
      );

      await writeAuditLog(pool, req.superadmin!.id, 'reactivate_org', 'organization', org.id, {
        previous_status: org.status,
      });

      res.json({ success: true, data: updated.rows[0] });
    } finally {
      client.release();
    }
  });

  // ── PUT /orgs/:id/plan ──────────────────────────────────────────────────────
  router.put('/orgs/:id/plan', async (req: Request, res: Response) => {
    const { plan_id } = req.body ?? {};
    if (!plan_id) {
      res.status(400).json({ success: false, error: 'plan_id is required' });
      return;
    }

    const pool = getPool(req);
    const org = await getOrgById(pool, req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    const client = await pool.connect();
    try {
      // Verify plan exists
      const planResult = await client.query(
        'SELECT id, name FROM plans WHERE id = $1',
        [plan_id],
      );
      if (planResult.rows.length === 0) {
        res.status(404).json({ success: false, error: `Plan ${plan_id} not found` });
        return;
      }

      const updated = await client.query(
        `UPDATE organizations SET plan_id = $1, updated_at = now()
          WHERE id = $2 RETURNING *`,
        [plan_id, org.id],
      );

      await writeAuditLog(pool, req.superadmin!.id, 'change_plan', 'organization', org.id, {
        previous_plan_id: org.plan_id,
        new_plan_id: plan_id,
      });

      res.json({ success: true, data: updated.rows[0] });
    } finally {
      client.release();
    }
  });

  // ── POST /orgs/:id/reset-trial ──────────────────────────────────────────────
  router.post('/orgs/:id/reset-trial', async (req: Request, res: Response) => {
    const pool = getPool(req);
    const org = await getOrgById(pool, req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    const client = await pool.connect();
    try {
      const updated = await client.query(
        `UPDATE organizations
            SET trial_ends_at = now() + interval '14 days',
                status = 'trial',
                updated_at = now()
          WHERE id = $1 RETURNING *`,
        [org.id],
      );

      await writeAuditLog(pool, req.superadmin!.id, 'reset_trial', 'organization', org.id, {
        previous_trial_ends_at: org.trial_ends_at,
      });

      res.json({ success: true, data: updated.rows[0] });
    } finally {
      client.release();
    }
  });

  // ── POST /impersonate ───────────────────────────────────────────────────────
  router.post('/impersonate', async (req: Request, res: Response) => {
    const { org_slug } = req.body ?? {};
    if (!org_slug) {
      res.status(400).json({ success: false, error: 'org_slug is required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET?.trim();
    if (!jwtSecret || jwtSecret.length < 32) {
      res.status(500).json({ success: false, error: 'Server misconfiguration: missing JWT_SECRET' });
      return;
    }

    const pool = getPool(req);
    const org = await getOrgBySlug(pool, org_slug);
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    // Mint a short-lived (1h) org-scoped impersonation token
    const token = jwt.sign(
      {
        org_id: org.id,
        org_slug: org.slug,
        impersonation: true,
        impersonated_by: req.superadmin!.id,
        // No user id / role — impersonation tokens are org-level only
      },
      jwtSecret,
      { expiresIn: '1h' },
    );

    await writeAuditLog(pool, req.superadmin!.id, 'impersonate', 'organization', org.id, {
      org_slug: org.slug,
    });

    res.json({ success: true, token });
  });

  return router;
}
