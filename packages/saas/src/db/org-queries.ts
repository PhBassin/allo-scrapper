/**
 * Database query helpers for the SaaS layer.
 * All queries operate against public.organizations and public.plans.
 */
import type { DB, Organization, InsertOrgInput, Plan } from './types.js';

/**
 * Build the PostgreSQL schema name from an org slug.
 * Replaces hyphens with underscores — slugs are validated to be [a-z0-9-].
 */
export function slugToSchemaName(slug: string): string {
  return `org_${slug.replace(/-/g, '_')}`;
}

export async function getOrgBySlug(db: DB, slug: string): Promise<Organization | null> {
  const result = await db.query<Organization>(
    'SELECT * FROM organizations WHERE slug = $1',
    [slug]
  );
  return result.rows[0] ?? null;
}

export async function getOrgById(db: DB, id: number): Promise<Organization | null> {
  const result = await db.query<Organization>(
    'SELECT * FROM organizations WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function insertOrg(db: DB, data: InsertOrgInput): Promise<Organization> {
  const schemaName = slugToSchemaName(data.slug);
  const result = await db.query<Organization>(
    `INSERT INTO organizations (name, slug, plan_id, schema_name, trial_ends_at)
     VALUES ($1, $2, $3, $4, now() + interval '14 days')
     RETURNING *`,
    [data.name, data.slug, data.plan_id ?? 1, schemaName]
  );
  return result.rows[0];
}

export async function isSlugAvailable(db: DB, slug: string): Promise<boolean> {
  const result = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM organizations WHERE slug = $1',
    [slug]
  );
  return parseInt(result.rows[0].count) === 0;
}

export async function getPlanById(db: DB, planId: number): Promise<Plan | null> {
  const result = await db.query<Plan>(
    'SELECT * FROM plans WHERE id = $1',
    [planId]
  );
  return result.rows[0] ?? null;
}
