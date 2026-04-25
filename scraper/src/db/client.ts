import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuration de la connexion PostgreSQL
const config = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD as string,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'its',
};

// Si une URL de base de données est fournie (ex: format Heroku ou Docker interne), elle est prioritaire
const connectionString = process.env.DATABASE_URL;

if (!connectionString && !process.env.POSTGRES_PASSWORD) {
  throw new Error('Either DATABASE_URL or POSTGRES_PASSWORD environment variable is required');
}

export const pool = new pg.Pool(
  connectionString ? { connectionString } : config
);

export const db = {
  query: <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => pool.query<T>(text, params),
  end: () => pool.end()
};

export type DB = typeof db;

function slugToSchemaName(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid tenant slug: ${slug}`);
  }

  return `org_${slug.replace(/-/g, '_')}`;
}

export async function withTenantDb<T>(orgSlug: string | undefined, run: (dbHandle: DB) => Promise<T>): Promise<T> {
  if (!orgSlug) {
    return await run(db);
  }

  const client = await pool.connect();
  const schemaName = slugToSchemaName(orgSlug);

  try {
    await client.query(`SET search_path TO "${schemaName}", public`);

    return await run({
      query: <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => client.query<T>(text, params),
      end: async () => {},
    });
  } finally {
    client.release();
  }
}
