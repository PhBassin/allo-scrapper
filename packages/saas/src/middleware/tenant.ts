import type { Request, Response, NextFunction } from 'express';
import { getOrgBySlug } from '../db/org-queries.js';
import type { Organization } from '../db/org-queries.js';
import type { Pool, PoolClient } from '../db/types.js';

// Augment Express Request with SaaS-specific properties
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      org?: Organization;
      dbClient?: PoolClient;
    }
  }
}

const ACTIVE_STATUSES = new Set(['trial', 'active']);

/** Minimal logger interface — resolved at runtime from the server's logger */
interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn?(msg: string, meta?: Record<string, unknown>): void;
}

let _logger: Logger | null = null;

/** Lazy-loads the server logger so we don't cross rootDir at compile time. */
async function getLogger(): Promise<Logger> {
  if (!_logger) {
    try {
      const mod = await import('../../../../server/src/utils/logger.js' as string) as { logger: Logger };
      _logger = mod.logger;
    } catch {
      // Fallback to console (e.g. in tests where the server module isn't available)
      _logger = { info: () => {}, warn: () => {} };
    }
  }
  return _logger;
}

/**
 * Tenant resolution middleware.
 *
 * 1. Reads :slug from route params
 * 2. Acquires a dedicated pg client from the pool (so SET search_path is scoped)
 * 3. Loads the organization from public.organizations
 * 4. Rejects suspended / canceled orgs
 * 5. Sets `search_path` to `org_{slug}, public` on the client
 * 6. Attaches `req.org` and `req.dbClient` for downstream route handlers
 * 7. Emits structured log with org_id and org_slug (Phase 7.5 observability)
 * 8. Releases the client after the response (or on error)
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  const slug = req.params.slug as string;
  const pool = req.app.get('pool') as Pool;

  const client = await pool.connect();

  try {
    const org = await getOrgBySlug(client, slug);

    if (!org) {
      client.release();
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }

    if (!ACTIVE_STATUSES.has(org.status)) {
      client.release();
      res.status(403).json({ success: false, error: `Organization is ${org.status}` });
      return;
    }

    // Scope all subsequent queries to the org's schema.
    // NOTE: PostgreSQL does not support $1 parameterized form for SET commands.
    // The schema name is safe here: slugs are validated to [a-z0-9-] and converted
    // to [a-z0-9_] by slugToSchemaName, making SQL injection impossible.
    await client.query(`SET search_path TO "${org.schema_name}", public`);

    req.org = org;
    req.dbClient = client;

    // Phase 7.5 — structured log with org context for observability
    const log = await getLogger();
    log.info('[resolveTenant] Tenant resolved', {
      org_id: org.id,
      org_slug: org.slug,
      method: req.method,
      path: req.path,
    });

    await next();
  } finally {
    // Always release the client back to the pool
    if (req.dbClient) {
      req.dbClient.release();
    }
  }
}
