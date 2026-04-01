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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = Record<string, any>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

/** pg.Pool interface for acquiring dedicated clients (tenant middleware) */
export interface Pool {
  connect(): Promise<PoolClient>;
}

export interface PoolClient extends DB {
  release(err?: Error): void;
}
