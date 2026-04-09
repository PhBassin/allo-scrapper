/**
 * Org data export route.
 * Generates a complete JSON export of an organization's data.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { DB, PoolClient } from '../db/types.js';
import { AuthError } from '../../../server/src/utils/errors.js';

// Extend Request to include dbClient and org from tenant middleware
declare global {
  namespace Express {
    interface Request {
      dbClient?: PoolClient;
      org?: {
        id: number;
        slug: string;
        schema_name: string;
      };
      user?: {
        id: number;
        permissions?: string[];
      };
    }
  }
}

export function createOrgExportRouter(): Router {
  const router = Router();

  // GET /export
  // Requires: resolveTenant middleware (provides req.dbClient, req.org)
  // Requires: requireAuth middleware (provides req.user)
  router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user has export_data permission
      const hasPermission = req.user?.permissions?.includes('export_data' as any);
      if (!hasPermission) {
        throw new AuthError('INSUFFICIENT_PERMISSIONS');
      }

      const db = req.app.get('db') as DB;
      const client = req.dbClient;
      const org = req.org;

      if (!client || !org) {
        res.status(500).json({
          success: false,
          error: 'TENANT_MIDDLEWARE_NOT_CONFIGURED',
        });
        return;
      }

      // Get org metadata from public schema
      const orgResult = await db.query(
        'SELECT * FROM organizations WHERE id = $1',
        [org.id]
      );

      if (orgResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'ORG_NOT_FOUND',
        });
        return;
      }

      // Query org's private schema for data (already set by resolveTenant)
      const [cinemasResult, showtimesResult, reportsResult, settingsResult] = await Promise.all([
        client.query('SELECT * FROM cinemas ORDER BY id'),
        client.query(`
          SELECT * FROM showtimes
          WHERE showtime >= now() - interval '7 days'
          ORDER BY showtime DESC
        `),
        client.query('SELECT * FROM reports ORDER BY id DESC LIMIT 100'),
        client.query('SELECT * FROM org_settings LIMIT 1'),
      ]);

      const exportData = {
        org: orgResult.rows[0],
        cinemas: cinemasResult.rows,
        showtimes: showtimesResult.rows,
        reports: reportsResult.rows,
        settings: settingsResult.rows[0] || null,
        exportedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: exportData,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
