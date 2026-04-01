import { Router, type Request, type Response } from 'express';
import { OrgExportService } from '../services/org-export-service.js';

/**
 * GET /api/org/:slug/export
 *
 * Returns a complete JSON snapshot of the org's data:
 * cinemas, showtimes, and org settings.
 *
 * Requires the resolveTenant middleware to have already run
 * (req.org and req.dbClient must be present).
 */
export function createOrgExportRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get('/export', async (req: Request, res: Response) => {
    try {
      const service = new OrgExportService(req.dbClient!);
      const data = await service.exportOrg(req.org!);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Export failed' });
    }
  });

  return router;
}
