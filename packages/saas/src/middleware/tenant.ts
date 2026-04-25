/**
 * Tenant resolution middleware.
 *
 * 1. Reads :slug from route params
 * 2. Acquires a dedicated pg client from the pool (so SET search_path is scoped)
 * 3. Loads the organization from public.organizations
 * 4. Rejects suspended / canceled orgs
 * 5. Sets `search_path` to `org_{slug}, public` on the client
 * 6. Attaches `req.org` and `req.dbClient` for downstream route handlers
 * 7. Releases the client after the response (or on error)
 */
import type { Request, Response, NextFunction } from 'express';
import { getOrgBySlug } from '../db/org-queries.js';
import type { Pool } from '../db/types.js';

const ACTIVE_STATUSES = new Set<string>(['trial', 'active']);

// Request augmentation moved to db/types.ts to avoid conflicts across middlewares

export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.params['slug'] as string;
  const pool = req.app.get('pool') as Pool;
  const client = await pool.connect();
  let released = false;

  const releaseOnce = async () => {
    if (!released) {
      released = true;
      try {
        await client.query('SET search_path TO public');
      } catch {
        // Ignore reset failures during release.
      }
      client.release();
    }
  };

  const scheduleReleaseOnResponse = () => {
    const cleanup = () => {
      res.off('finish', cleanup);
      res.off('close', cleanup);
      void releaseOnce();
    };

    res.once('finish', cleanup);
    res.once('close', cleanup);
  };

  try {
    const org = await getOrgBySlug(client, slug);

    if (!org) {
      await releaseOnce();
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    if (!ACTIVE_STATUSES.has(org.status)) {
      await releaseOnce();
      res.status(403).json({ success: false, error: `Organization is ${org.status}` });
      return;
    }

    // Scope all subsequent queries to the org's schema.
    // NOTE: PostgreSQL does not support $1 parameterized form for SET commands.
    // The schema name is safe: slugs are validated to [a-z0-9-] and converted
    // to [a-z0-9_] by slugToSchemaName, making SQL injection impossible.
    await client.query(`SET search_path TO "${org.schema_name}", public`);

    req.org = org;
    req.dbClient = client;
    scheduleReleaseOnResponse();

    await next();
  } catch (error) {
    await releaseOnce();
    throw error;
  }
}
