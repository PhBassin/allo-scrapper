import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRefreshTokenExpiry,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  REUSE_GRACE_MS,
} from './refresh-token-repository.js';
import type { DB } from '../db/index.js';
import { logger } from '../utils/logger.js';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/**
 * Refresh-token repository tests.
 *
 * After the data-access seam was collapsed (see issue #1235), the SQL
 * primitives are private internals of this module. These tests therefore mock
 * the DB (`query` / `transaction`) directly and assert behavior end-to-end
 * across the public surface — covering both the policy layer (hashing, expiry)
 * and the underlying SQL it drives.
 */
describe('refresh-token-repository', () => {
  let mockDb: DB;

  const now = new Date('2026-06-21T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    } as unknown as DB;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Runs the transaction callback against a client answering `results` in order. */
  const mockTransaction = (...results: unknown[]) => {
    const clientQuery = vi.fn();
    for (const r of results) clientQuery.mockResolvedValueOnce(r);
    vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => fn({ query: clientQuery }));
    return clientQuery;
  };
  const LOCKED = { rows: [{ '?column?': 1 }], rowCount: 1 };

  describe('parseRefreshTokenExpiry', () => {
    const originalEnv = process.env.REFRESH_TOKEN_EXPIRY;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.REFRESH_TOKEN_EXPIRY;
      } else {
        process.env.REFRESH_TOKEN_EXPIRY = originalEnv;
      }
    });

    it('should return 7 days (ms) when env var is not set', () => {
      delete process.env.REFRESH_TOKEN_EXPIRY;
      expect(parseRefreshTokenExpiry()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should parse "7d" as 7 days in ms', () => {
      process.env.REFRESH_TOKEN_EXPIRY = '7d';
      expect(parseRefreshTokenExpiry()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should parse "30d" as 30 days in ms', () => {
      process.env.REFRESH_TOKEN_EXPIRY = '30d';
      expect(parseRefreshTokenExpiry()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should parse "24h" as 24 hours in ms', () => {
      process.env.REFRESH_TOKEN_EXPIRY = '24h';
      expect(parseRefreshTokenExpiry()).toBe(24 * 60 * 60 * 1000);
    });

    it('should parse numeric string as ms', () => {
      process.env.REFRESH_TOKEN_EXPIRY = '3600000';
      expect(parseRefreshTokenExpiry()).toBe(3600000);
    });

    it('should fallback to 7d on zero days', () => {
      process.env.REFRESH_TOKEN_EXPIRY = '0d';
      expect(parseRefreshTokenExpiry()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should fallback to 7d on zero hours', () => {
      process.env.REFRESH_TOKEN_EXPIRY = '0h';
      expect(parseRefreshTokenExpiry()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should fallback to 7d on invalid value', () => {
      process.env.REFRESH_TOKEN_EXPIRY = 'invalid';
      expect(parseRefreshTokenExpiry()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a raw token and store its hash via INSERT', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

      const token = await generateRefreshToken(mockDb, 1);

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(32);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        [1, expect.any(String), expect.any(Date)],
      );
    });

    it('should accept custom expiry', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

      const token = await generateRefreshToken(mockDb, 1, 3600_000);

      expect(token).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        [1, expect.any(String), expect.any(Date)],
      );
    });
  });

  describe('validateRefreshToken', () => {
    const tokenRow = (overrides: Record<string, unknown> = {}) => ({
      rows: [{
        id: 1,
        user_id: 42,
        token_hash: 'hashed',
        expires_at: new Date('2026-06-22T12:00:00Z'), // 1 day later
        created_at: now,
        revoked_at: null,
        replaced_by_id: null,
        in_reuse_grace: false,
        ...overrides,
      }],
    } as any);

    /** A token rotated `agoMs` ago, replaced by token #2 (the DB computes the grace flag). */
    const rotatedRow = (agoMs: number) =>
      tokenRow({
        revoked_at: new Date(now.getTime() - agoMs),
        replaced_by_id: 2,
        in_reuse_grace: agoMs < REUSE_GRACE_MS,
      });

    it('should return the userId for a valid non-expired non-revoked token', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(tokenRow());

      const result = await validateRefreshToken(mockDb, 'valid-raw-token');

      expect(result).toEqual({ status: 'valid', userId: 42 });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [expect.any(String), REUSE_GRACE_MS],
      );
    });

    it('should let the database measure the grace window (no app/DB clock skew)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(tokenRow());

      await validateRefreshToken(mockDb, 'valid-raw-token');

      expect(vi.mocked(mockDb.query).mock.calls[0][0]).toContain(
        "revoked_at > NOW() - INTERVAL '1 millisecond' * $2::integer",
      );
    });

    it('should trust the database grace flag over the app clock', async () => {
      // The app clock says "seconds ago", the DB (which wrote revoked_at) says otherwise.
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce(tokenRow({ revoked_at: now, replaced_by_id: 2, in_reuse_grace: false }));
      const txQuery = mockTransaction(LOCKED, { rows: [{ id: 2, replaced_by_id: null }] }, { rows: [], rowCount: 1 });

      const result = await validateRefreshToken(mockDb, 'replayed-token');

      expect(result).toEqual({ status: 'rejected' });
      expect(txQuery).toHaveBeenCalledTimes(3);
    });

    it('should reject an unknown token', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [] } as any);

      const result = await validateRefreshToken(mockDb, 'unknown-token');

      expect(result).toEqual({ status: 'rejected' });
    });

    it('should reject an expired token', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(
        tokenRow({ expires_at: new Date('2026-06-20T12:00:00Z') }),
      );

      const result = await validateRefreshToken(mockDb, 'expired-token');

      expect(result).toEqual({ status: 'rejected' });
    });

    it('should reject a deliberately revoked token without any revocation (not a rotation)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(
        tokenRow({ revoked_at: new Date('2026-06-20T12:00:00Z') }),
      );

      const result = await validateRefreshToken(mockDb, 'logged-out-token');

      expect(result).toEqual({ status: 'rejected' });
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should report a race without revoking anything inside the grace window', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(rotatedRow(REUSE_GRACE_MS - 1));

      const result = await validateRefreshToken(mockDb, 'just-rotated-token');

      expect(result).toEqual({ status: 'race' });
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should revoke every user token when a rotated token is replayed and its successor was used', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(rotatedRow(REUSE_GRACE_MS + 1));
      const txQuery = mockTransaction(LOCKED, { rows: [{ id: 2, replaced_by_id: 3 }] }, { rows: [], rowCount: 3 });

      const result = await validateRefreshToken(mockDb, 'replayed-token');

      expect(result).toEqual({ status: 'rejected' });
      expect(txQuery).toHaveBeenNthCalledWith(1, expect.stringContaining('FOR NO KEY UPDATE'), [42]);
      expect(txQuery).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE id = $1'), [2]);
      expect(txQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND revoked_at IS NULL'),
        [42],
      );
    });

    it('should revoke only the unused successor when a rotated token is replayed', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(rotatedRow(15 * 60 * 1000));
      const txQuery = mockTransaction(LOCKED, { rows: [{ id: 2, replaced_by_id: null }] }, { rows: [], rowCount: 1 });

      const result = await validateRefreshToken(mockDb, 'lost-response-token');

      expect(result).toEqual({ status: 'rejected' });
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(txQuery).toHaveBeenCalledTimes(3);
      expect(txQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE id = $1 AND revoked_at IS NULL'),
        [2],
      );
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('its unused successor revoked'), { userId: 42 });
    });

    it('should not claim a revocation when the successor was already revoked', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(rotatedRow(15 * 60 * 1000));
      mockTransaction(LOCKED, { rows: [{ id: 2, replaced_by_id: null }] }, { rows: [], rowCount: 0 });

      const result = await validateRefreshToken(mockDb, 'replayed-after-logout');

      expect(result).toEqual({ status: 'rejected' });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('successor was already revoked'), { userId: 42 });
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('its unused successor revoked'), expect.anything());
    });
  });

  describe('revokeRefreshToken', () => {
    const storedRow = (overrides: Record<string, unknown>) => ({
      rows: [{
        id: 1,
        user_id: 42,
        token_hash: 'hashed',
        expires_at: new Date('2026-06-22T12:00:00Z'),
        created_at: now,
        revoked_at: now,
        replaced_by_id: null,
        in_reuse_grace: true,
        ...overrides,
      }],
    } as any);

    it('should issue an UPDATE revoking the matching active token by hash', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await revokeRefreshToken(mockDb, 'token-to-revoke');

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [expect.any(String)],
      );
    });

    it('should do nothing more for an unknown or deliberately revoked token', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce(storedRow({ replaced_by_id: null }));

      await revokeRefreshToken(mockDb, 'already-revoked');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should revoke the unused successor when logging out with a rotated token, even inside the grace window', async () => {
      // e.g. the thief won the refresh race; the victim's browser still holds the old token
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce(storedRow({ replaced_by_id: 2, in_reuse_grace: true }));
      const txQuery = mockTransaction(LOCKED, { rows: [{ id: 2, replaced_by_id: null }] }, { rows: [], rowCount: 1 });

      await revokeRefreshToken(mockDb, 'stale-token');

      expect(txQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE id = $1 AND revoked_at IS NULL'),
        [2],
      );
    });

    it('should revoke every user token when logging out with a rotated token whose successor was used', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce(storedRow({ replaced_by_id: 2 }));
      const txQuery = mockTransaction(LOCKED, { rows: [{ id: 2, replaced_by_id: 3 }] }, { rows: [], rowCount: 2 });

      await revokeRefreshToken(mockDb, 'stale-token');

      expect(txQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND revoked_at IS NULL'),
        [42],
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should take the session lock, then revoke all active tokens for the user', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

      await revokeAllUserTokens(mockDb, 42);

      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM users WHERE id = $1 FOR NO KEY UPDATE'),
        [42],
      );
      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [42],
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should atomically generate new, then revoke old and link it to its successor, in a transaction', async () => {
      let committed = false;
      let clientQueries: ReturnType<typeof vi.fn> | undefined;

      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce(LOCKED)                             // session lock (shared)
          .mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 }) // insert new
          .mockResolvedValueOnce({ rows: [], rowCount: 1 });         // revoke old + link successor
        clientQueries = clientQuery;
        const result = await fn({ query: clientQuery });
        committed = true;
        return result;
      });

      const rotation = await rotateRefreshToken(mockDb, 1, 'old-token');

      expect(rotation.status).toBe('rotated');
      expect(rotation.status === 'rotated' && rotation.token.length).toBeGreaterThan(32);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(committed).toBe(true);
      expect(clientQueries).toHaveBeenCalledTimes(3);
      expect(clientQueries).toHaveBeenNthCalledWith(1, expect.stringContaining('FOR SHARE'), [1]);
      expect(clientQueries).toHaveBeenLastCalledWith(
        expect.stringContaining('SET revoked_at = NOW(), replaced_by_id = $1'),
        [8, expect.any(String), 1],
      );
    });

    it('should accept custom expiry', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce(LOCKED)
          .mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 });
        return fn({ query: clientQuery });
      });

      const rotation = await rotateRefreshToken(mockDb, 1, 'old-token', 3600_000);

      expect(rotation.status).toBe('rotated');
    });

    /** The transaction rolls back (rejects) when its callback throws, like the real one. */
    const staleRotation = () => {
      let rolledBack = false;
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce(LOCKED)                             // session lock (shared)
          .mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 }) // insert new
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });         // old token no longer live
        try {
          return await fn({ query: clientQuery });
        } catch (err) {
          rolledBack = true;
          throw err;
        }
      });
      return () => rolledBack;
    };

    it('should report a race and roll back the insert when the old token was rotated concurrently', async () => {
      const rolledBack = staleRotation();
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [{ replaced_by_id: 9 }] } as any);

      const result = await rotateRefreshToken(mockDb, 1, 'raced-token');

      expect(result).toEqual({ status: 'race' });
      expect(rolledBack()).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT replaced_by_id FROM refresh_tokens'),
        [expect.any(String)],
      );
    });

    it('should reject and roll back the insert when the old token was revoked on purpose meanwhile', async () => {
      const rolledBack = staleRotation();
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [{ replaced_by_id: null }] } as any); // e.g. admin reset

      const result = await rotateRefreshToken(mockDb, 1, 'revoked-token');

      expect(result).toEqual({ status: 'rejected' });
      expect(rolledBack()).toBe(true);
    });

    it('should reject without inserting when the user was deleted meanwhile', async () => {
      const txQuery = mockTransaction({ rows: [], rowCount: 0 }); // session lock finds no user row
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [] } as any); // its tokens went with it

      const result = await rotateRefreshToken(mockDb, 1, 'orphaned-token');

      expect(result).toEqual({ status: 'rejected' });
      expect(txQuery).toHaveBeenCalledTimes(1);
      expect(txQuery).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'), [1]);
    });

    it('should propagate unexpected transaction errors', async () => {
      vi.mocked(mockDb.transaction).mockRejectedValue(new Error('db down'));

      await expect(rotateRefreshToken(mockDb, 1, 'old-token')).rejects.toThrow('db down');
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and old revoked tokens with default 30 days', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: '3' }],
        rowCount: 1,
      } as any);

      const count = await cleanupExpiredTokens(mockDb);

      expect(count).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [30],
      );
    });

    it('should accept custom retention days', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as any);

      const count = await cleanupExpiredTokens(mockDb, 7);

      expect(count).toBe(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [7],
      );
    });
  });
});
