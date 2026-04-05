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
import type { Organization, Pool, PoolClient } from '../db/types.js';

const ACTIVE_STATUSES = new Set<string>(['trial', 'active']);

// Extend Express Request to carry tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      org: Organization;
      dbClient: PoolClient;
    }
  }
}

export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.params['slug'] as string;
  const pool = req.app.get('pool') as Pool;
  const client = await pool.connect();
  let released = false;

  const releaseOnce = () => {
    if (!released) {
      released = true;
      client.release();
    }
  };

  try {
    const org = await getOrgBySlug(client, slug);

    if (!org) {
      releaseOnce();
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    if (!ACTIVE_STATUSES.has(org.status)) {
      releaseOnce();
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

    await next();
  } finally {
    // Always release the client back to the pool (no-op if already released above)
    releaseOnce();
  }
}
