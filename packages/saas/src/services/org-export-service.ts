import type { PoolClient } from '../db/types.js';
import type { Organization } from '../db/org-queries.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgExportData {
  org: {
    slug: string;
    name: string;
  };
  cinemas: Record<string, unknown>[];
  showtimes: Record<string, unknown>[];
  settings: Record<string, unknown>;
  exported_at: string;
}

// ── OrgExportService ──────────────────────────────────────────────────────────

/**
 * Exports a complete snapshot of an org's data as a JSON-serialisable object.
 *
 * Queries are issued against the already-scoped search_path (set by
 * resolveTenant middleware) so no schema prefix is needed in SQL.
 */
export class OrgExportService {
  constructor(private readonly client: PoolClient) {}

  async exportOrg(org: Pick<Organization, 'id' | 'slug' | 'name'>): Promise<OrgExportData> {
    // Fetch cinemas from org schema
    const cinemasResult = await this.client.query<Record<string, unknown>>(
      'SELECT * FROM cinemas ORDER BY id'
    );

    // Fetch showtimes from org schema
    const showtimesResult = await this.client.query<Record<string, unknown>>(
      'SELECT * FROM showtimes ORDER BY cinema_id, show_time'
    );

    // Fetch org settings from org schema
    const settingsResult = await this.client.query<Record<string, unknown>>(
      'SELECT * FROM org_settings LIMIT 1'
    );

    return {
      org: {
        slug: org.slug,
        name: org.name,
      },
      cinemas: cinemasResult.rows,
      showtimes: showtimesResult.rows,
      settings: settingsResult.rows[0] ?? {},
      exported_at: new Date().toISOString(),
    };
  }
}
