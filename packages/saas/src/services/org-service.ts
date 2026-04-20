/**
 * Org creation service.
 *
 * Full flow:
 *  1. Validate slug availability
 *  2. INSERT into public.organizations
 *  3. CREATE SCHEMA org_{slug}
 *  4. Bootstrap org schema tables (users, roles, etc.)
 */
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { insertOrg, isSlugAvailable, slugToSchemaName } from '../db/org-queries.js';
import type { DB, Organization, InsertOrgInput } from '../db/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getOrgSchemaBootstrapDir(): string {
  const isProduction = process.env['NODE_ENV'] === 'production';
  return isProduction
    ? path.join('/app', 'packages', 'saas', 'migrations', 'org_schema')
    : path.join(__dirname, '../../../../../migrations/org_schema');
}

/**
 * Run all SQL files in org_schema/ within the new org's schema.
 * Files are sorted by filename and run in order.
 */
async function bootstrapOrgSchema(db: DB, schemaName: string): Promise<void> {
  const bootstrapDir = getOrgSchemaBootstrapDir();
  let files: string[];
  try {
    files = (await fs.readdir(bootstrapDir)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    // Bootstrap dir may not exist in test environments — skip silently
    return;
  }

  for (const file of files) {
    const sql = await fs.readFile(path.join(bootstrapDir, file), 'utf8');
    // NOTE: PostgreSQL does not support $1 parameterized form for SET commands.
    // schemaName is safe: derived from slugToSchemaName which produces [a-z0-9_] only.
    await db.query(`SET search_path TO "${schemaName}", public`);
    await db.query(sql);
  }

  // Reset to public after bootstrapping
  await db.query('SET search_path TO public');
}

export interface CreateOrgResult {
  org: Organization;
  schemaCreated: boolean;
}

export async function createOrg(
  db: DB,
  input: InsertOrgInput
): Promise<CreateOrgResult> {
  const slugAvailable = await isSlugAvailable(db, input.slug);
  if (!slugAvailable) {
    throw new Error(`Slug "${input.slug}" is already taken`);
  }

  await db.query('BEGIN');
  try {
    const org = await insertOrg(db, input);
    const schemaName = slugToSchemaName(input.slug);

    // Create the PostgreSQL schema for this org
    await db.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // Bootstrap all org-level tables
    await bootstrapOrgSchema(db, schemaName);

    await db.query('COMMIT');
    return { org, schemaCreated: true };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
