/**
 * Superadmin REST API routes.
 * Provides dashboard metrics, org management, impersonation, and audit log access.
 */
import { Router, type Request, type Response } from 'express';
import { SuperadminAuthService } from '../services/superadmin-auth-service.js';
import { requireSuperadmin } from '../middleware/superadmin-auth.js';
import type { DB, Pool, Organization } from '../db/types.js';
import jwt from 'jsonwebtoken';

export function createSuperadminRouter(): Router {
  const router = Router();

  // POST /api/superadmin/login (public - no auth)
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'MISSING_CREDENTIALS',
        });
        return;
      }

      const db = req.app.get('db') as DB;
      const authService = new SuperadminAuthService(db);
      const result = await authService.login(username, password);

      if (!result) {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Superadmin login error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // GET /api/superadmin/dashboard (protected)
  router.get('/dashboard', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;

      // Get org counts
      const countsResult = await db.query<{
        total_orgs: number;
        active_orgs: number;
        suspended_orgs: number;
        new_orgs_this_week: number;
      }>(`
        SELECT
          COUNT(*) as total_orgs,
          COUNT(*) FILTER (WHERE status IN ('active', 'trial')) as active_orgs,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended_orgs,
          COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as new_orgs_this_week
        FROM organizations
      `);

      const counts = countsResult.rows[0];

      // Get orgs by plan
      const planStatsResult = await db.query<{ plan_name: string; count: number }>(`
        SELECT p.name as plan_name, COUNT(o.id)::int as count
        FROM plans p
        LEFT JOIN organizations o ON o.plan_id = p.id
        GROUP BY p.id, p.name
        ORDER BY p.id
      `);

      res.json({
        success: true,
        data: {
          totalOrgs: counts.total_orgs,
          activeOrgs: counts.active_orgs,
          suspendedOrgs: counts.suspended_orgs,
          newOrgsThisWeek: counts.new_orgs_this_week,
          orgsByPlan: planStatsResult.rows,
        },
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // GET /api/superadmin/orgs (protected)
  router.get('/orgs', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const page = parseInt((req.query.page as string) || '1');
      const pageSize = parseInt((req.query.pageSize as string) || '20');
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const offset = (page - 1) * pageSize;

      let whereConditions: string[] = [];
      let params: unknown[] = [];
      let paramIndex = 1;

      if (status) {
        whereConditions.push(`o.status = $${paramIndex++}`);
        params.push(status);
      }

      if (search) {
        whereConditions.push(`(o.name ILIKE $${paramIndex} OR o.slug ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get paginated orgs
      const orgsResult = await db.query<Organization & { plan_name: string }>(`
        SELECT o.*, p.name as plan_name
        FROM organizations o
        LEFT JOIN plans p ON o.plan_id = p.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...params, pageSize, offset]);

      // Get total count
      const countResult = await db.query<{ count: string }>(`
        SELECT COUNT(*) as count FROM organizations o ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          orgs: orgsResult.rows,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('List orgs error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // GET /api/superadmin/orgs/:id (protected)
  router.get('/orgs/:id', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const pool = req.app.get('pool') as Pool;
      const orgId = parseInt(req.params.id);

      // Get org details
      const orgResult = await db.query<Organization & { plan_name: string }>(`
        SELECT o.*, p.name as plan_name
        FROM organizations o
        LEFT JOIN plans p ON o.plan_id = p.id
        WHERE o.id = $1
      `, [orgId]);

      if (orgResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'ORG_NOT_FOUND',
        });
        return;
      }

      const org = orgResult.rows[0];

      // Get member and cinema counts from org schema
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${org.schema_name}, public`);

        const [membersResult, cinemasResult] = await Promise.all([
          client.query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
          client.query<{ count: string }>('SELECT COUNT(*) as count FROM cinemas'),
        ]);

        const membersCount = parseInt(membersResult.rows[0].count);
        const cinemasCount = parseInt(cinemasResult.rows[0].count);

        res.json({
          success: true,
          data: {
            org,
            membersCount,
            cinemasCount,
          },
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Get org detail error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // POST /api/superadmin/orgs/:id/suspend (protected)
  router.post('/orgs/:id/suspend', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const orgId = parseInt(req.params.id);
      const actorId = req.superadmin!.id;

      await db.query(`UPDATE organizations SET status = 'suspended' WHERE id = $1`, [orgId]);
      await db.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, 'suspend_org', 'organization', String(orgId), JSON.stringify({})]
      );

      res.json({
        success: true,
        data: { message: 'Organization suspended' },
      });
    } catch (error) {
      console.error('Suspend org error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // POST /api/superadmin/orgs/:id/reactivate (protected)
  router.post('/orgs/:id/reactivate', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const orgId = parseInt(req.params.id);
      const actorId = req.superadmin!.id;

      await db.query(`UPDATE organizations SET status = 'active' WHERE id = $1`, [orgId]);
      await db.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, 'reactivate_org', 'organization', String(orgId), JSON.stringify({})]
      );

      res.json({
        success: true,
        data: { message: 'Organization reactivated' },
      });
    } catch (error) {
      console.error('Reactivate org error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // PUT /api/superadmin/orgs/:id/plan (protected)
  router.put('/orgs/:id/plan', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const orgId = parseInt(req.params.id);
      const { plan_id } = req.body;
      const actorId = req.superadmin!.id;

      if (!plan_id) {
        res.status(400).json({
          success: false,
          error: 'MISSING_PLAN_ID',
        });
        return;
      }

      // Get current plan for audit
      const orgResult = await db.query<{ plan_id: number }>(
        'SELECT plan_id FROM organizations WHERE id = $1',
        [orgId]
      );

      if (orgResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'ORG_NOT_FOUND',
        });
        return;
      }

      const oldPlanId = orgResult.rows[0].plan_id;

      await db.query(`UPDATE organizations SET plan_id = $1 WHERE id = $2`, [plan_id, orgId]);
      await db.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorId,
          'change_plan',
          'organization',
          String(orgId),
          JSON.stringify({ old_plan_id: oldPlanId, new_plan_id: plan_id }),
        ]
      );

      res.json({
        success: true,
        data: { message: 'Plan updated' },
      });
    } catch (error) {
      console.error('Change plan error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // POST /api/superadmin/orgs/:id/reset-trial (protected)
  router.post('/orgs/:id/reset-trial', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const orgId = parseInt(req.params.id);
      const actorId = req.superadmin!.id;

      await db.query(
        `UPDATE organizations
         SET trial_ends_at = now() + interval '14 days', status = 'trial'
         WHERE id = $1`,
        [orgId]
      );
      await db.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, 'reset_trial', 'organization', String(orgId), JSON.stringify({})]
      );

      res.json({
        success: true,
        data: { message: 'Trial reset to 14 days' },
      });
    } catch (error) {
      console.error('Reset trial error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // POST /api/superadmin/impersonate (protected)
  router.post('/impersonate', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const pool = req.app.get('pool') as Pool;
      const { org_slug } = req.body;
      const actorId = req.superadmin!.id;

      if (!org_slug) {
        res.status(400).json({
          success: false,
          error: 'MISSING_ORG_SLUG',
        });
        return;
      }

      // Get org
      const orgResult = await db.query<Organization>(
        'SELECT * FROM organizations WHERE slug = $1',
        [org_slug]
      );

      if (orgResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'ORG_NOT_FOUND',
        });
        return;
      }

      const org = orgResult.rows[0];

      // Get first admin user from org schema
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${org.schema_name}, public`);

        const userResult = await client.query<{ id: number; username: string; role_id: number }>(
          'SELECT id, username, role_id FROM users ORDER BY id ASC LIMIT 1'
        );

        if (userResult.rows.length === 0) {
          res.status(400).json({
            success: false,
            error: 'NO_USERS_IN_ORG',
          });
          return;
        }

        const user = userResult.rows[0];

        // Get role and permissions
        const roleResult = await client.query<{ name: string; permissions: string }>(
          'SELECT name, permissions FROM roles WHERE id = $1',
          [user.role_id]
        );

        const role = roleResult.rows[0];
        const permissions = JSON.parse(role.permissions);

        // Mint temporary token (1h expiry) with impersonated flag
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET not configured');
        }

        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            org_id: org.id,
            org_slug: org.slug,
            role_id: user.role_id,
            role_name: role.name,
            permissions,
            impersonated: true,
          },
          secret,
          { expiresIn: '1h' }
        );

        // Log impersonation
        await db.query(
          `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            actorId,
            'impersonate',
            'organization',
            String(org.id),
            JSON.stringify({ org_slug, user_id: user.id }),
          ]
        );

        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

        res.json({
          success: true,
          data: {
            token,
            expiresAt,
            org: {
              id: org.id,
              slug: org.slug,
              name: org.name,
            },
          },
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Impersonation error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // GET /api/superadmin/audit-log (protected)
  router.get('/audit-log', requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as DB;
      const page = parseInt((req.query.page as string) || '1');
      const pageSize = parseInt((req.query.pageSize as string) || '50');
      const offset = (page - 1) * pageSize;

      const logsResult = await db.query<{
        id: string;
        actor_id: string;
        action: string;
        target_type: string;
        target_id: string;
        metadata: Record<string, unknown>;
        created_at: Date;
      }>(`
        SELECT * FROM audit_log
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]);

      const countResult = await db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM audit_log'
      );

      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          logs: logsResult.rows,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('Audit log error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  return router;
}
