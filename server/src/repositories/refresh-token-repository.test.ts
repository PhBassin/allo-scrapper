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
    it('should return userId for valid non-expired non-revoked token', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 42,
          token_hash: 'hashed',
          expires_at: new Date('2026-06-22T12:00:00Z'), // 1 day later
          created_at: now,
          revoked_at: null,
        }],
      } as any);

      const result = await validateRefreshToken(mockDb, 'valid-raw-token');

      expect(result).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [expect.any(String)],
      );
    });

    it('should return null for unknown token', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [] } as any);

      const result = await validateRefreshToken(mockDb, 'unknown-token');

      expect(result).toBeNull();
    });

    const revokedRow = (revokedAt: Date) => ({
      rows: [{
        id: 1,
        user_id: 42,
        token_hash: 'hashed',
        expires_at: new Date('2026-06-22T12:00:00Z'),
        created_at: now,
        revoked_at: revokedAt,
      }],
    } as any);

    it('should return null and revoke every user token when a token is reused after the grace window', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce(revokedRow(new Date('2026-06-20T12:00:00Z')))
        .mockResolvedValueOnce({ rows: [], rowCount: 3 } as any);

      const result = await validateRefreshToken(mockDb, 'revoked-token');

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND revoked_at IS NULL'),
        [42],
      );
    });

    it('should return null without revoking the family inside the grace window (multi-tab race)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(
        revokedRow(new Date(now.getTime() - REUSE_GRACE_MS)),
      );

      const result = await validateRefreshToken(mockDb, 'just-rotated-token');

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should revoke the family as soon as the grace window has elapsed', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce(revokedRow(new Date(now.getTime() - REUSE_GRACE_MS - 1)))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await validateRefreshToken(mockDb, 'replayed-token');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should return null for expired token', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 42,
          token_hash: 'hashed',
          expires_at: new Date('2026-06-20T12:00:00Z'), // 1 day ago
          created_at: now,
          revoked_at: null,
        }],
      } as any);

      const result = await validateRefreshToken(mockDb, 'expired-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should issue an UPDATE revoking the matching active token by hash', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

      await revokeRefreshToken(mockDb, 'token-to-revoke');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [expect.any(String)],
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should issue an UPDATE revoking all active tokens for the user', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

      await revokeAllUserTokens(mockDb, 42);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [42],
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should atomically revoke old and generate new token in a transaction', async () => {
      let committed = false;

      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE
          .mockResolvedValueOnce({ rows: [] });             // INSERT
        const client = { query: clientQuery };
        const result = await fn(client);
        committed = true;
        return result;
      });

      const newToken = await rotateRefreshToken(mockDb, 1, 'old-token');

      expect(newToken).toBeDefined();
      expect(newToken.length).toBeGreaterThan(32);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(committed).toBe(true);
    });

    it('should accept custom expiry', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [] });
        return fn({ query: clientQuery });
      });

      const newToken = await rotateRefreshToken(mockDb, 1, 'old-token', 3600_000);

      expect(newToken).toBeDefined();
    });

    it('should return null and insert nothing when the old token was consumed concurrently', async () => {
      const clientQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE matched nothing
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => fn({ query: clientQuery }));

      const result = await rotateRefreshToken(mockDb, 1, 'bad-token');

      expect(result).toBeNull();
      expect(clientQuery).toHaveBeenCalledTimes(1);
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
