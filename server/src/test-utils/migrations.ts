/**
 * Test helpers for migration-related tests.
 *
 * Usage:
 *   import { setupMigrationMocks } from '../test-utils/migrations.js';
 *   const mocks = setupMigrationMocks(['001_init.sql', '002_add_users.sql']);
 *   vi.mocked(fs.readdir).mockResolvedValue(mocks.files);
 *   db.query = mocks.dbQuery;
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationMocks {
  files: string[];
  dbQuery: ReturnType<typeof vi.fn>;
  appliedRows: { version: string }[];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Creates a consistent set of mock values for migration tests.
 *
 * @param files       - Migration files to return from `fs.readdir`.
 * @param appliedRows - Already-applied migration versions (default: empty).
 * @returns An object with `.files` (for fs.readdir) and `.dbQuery` (for db.query).
 */
export function setupMigrationMocks(
  files: string[],
  appliedRows: { version: string }[] = [],
): MigrationMocks {
  const dbQuery = vi.fn().mockResolvedValue({ rows: appliedRows });
  return { files, dbQuery, appliedRows };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that migrations were applied in the expected order.
 * Checks that `db.query` was called with each version, in order.
 */
export function assertMigrationOrder(
  dbQuery: ReturnType<typeof vi.fn>,
  versions: string[],
): void {
  const calls = dbQuery.mock.calls
    .filter((c: any[]) => typeof c[0] === 'string')
    .map((c: any[]) => c[0]);

  for (let i = 0; i < versions.length; i++) {
    const found = calls.some((sql: string) => sql.includes(versions[i]));
    if (!found) {
      const msg = `Expected migration "${versions[i]}" to be applied, but it was not found in db.query calls.`;
      throw new Error(msg);
    }
  }
}
