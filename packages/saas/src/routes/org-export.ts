/**
 * Org data export route.
 * Generates a complete JSON export of an organization's data.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { DB } from '../db/types.js';
import { AuthError } from 'allo-scrapper-server/dist/utils/errors.js';

// Request augmentation moved to db/types.ts to avoid conflicts across middlewares


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

      // Get org metadata from public schema (filtered for privacy)
      const orgResult = await db.query(
        'SELECT id, name, slug, status, plan_id, trial_ends_at, created_at FROM organizations WHERE id = $1',
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

      // Filter org data to avoid leaking internal fields
      const { 
        id, name, slug, status, plan_id, trial_ends_at, created_at 
      } = orgResult.rows[0];
      
      const filteredOrg = { 
        id, name, slug, status, plan_id, trial_ends_at, created_at 
      };

      const exportData = {
        org: filteredOrg,
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
