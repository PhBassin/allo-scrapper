/**
 * Minimal DB interfaces for the SaaS package.
 * Compatible with the server's pg.Pool-backed db wrapper.
 */

export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

/** Thin query wrapper (matches server/src/db/client.ts `db` object) */
export interface DB {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/** pg.Pool interface for acquiring dedicated clients (tenant middleware) */
export interface Pool {
  connect(): Promise<PoolClient>;
}

export interface PoolClient extends DB {
  release(err?: Error): void;
}

/** A row from public.organizations */
export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan_id: number;
  schema_name: string;
  status: 'trial' | 'active' | 'suspended' | 'canceled';
  trial_ends_at: string | null;
  created_at?: string;
  updated_at?: string;
}

/** A row from public.plans */
export interface Plan {
  id: number;
  name: string;
  max_cinemas: number;
  max_users: number;
  max_scrapes_per_day: number;
}

/** Input for inserting a new org */
export interface InsertOrgInput {
  name: string;
  slug: string;
  plan_id?: number;
}

/** Input for minting a JWT */
export interface MintJwtInput {
  userId: number;
  username: string;
  orgId: number;
  orgSlug: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}
