import type { Request } from 'express';
import type { DB } from '../db/client.js';

/**
 * Returns the tenant-scoped database client when running in SaaS mode
 * (req.dbClient set by resolveTenant middleware), or the global shared db
 * when running in standalone mode.
 *
 * This is the single point of DB injection that allows all existing route
 * handlers to work unchanged under both /api/* (standalone) and
 * /api/org/:slug/* (SaaS, search_path scoped to tenant schema).
 */
export function getDbFromRequest(req: Request): DB {
  return ((req as unknown as { dbClient?: DB }).dbClient) ?? req.app.get('db');
}
