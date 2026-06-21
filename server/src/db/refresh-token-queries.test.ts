import { describe, it, expect, vi } from 'vitest';
import {
  insertRefreshToken,
  findByTokenHash,
  revokeByTokenHash,
  revokeByUserId,
  cleanupExpired,
  rotateRefreshToken,
  type RefreshTokenRow,
} from './refresh-token-queries.js';
import type { DB } from './index.js';

describe('refresh-token-queries', () => {
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    } as unknown as DB;
  });

  describe('insertRefreshToken', () => {
    it('should insert a token hash with expiry', async () => {
      const expiresAt = new Date('2026-07-01T00:00:00Z');

      await insertRefreshToken(mockDb, 1, 'abc123hash', expiresAt);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        [1, 'abc123hash', expiresAt]
      );
    });
  });

  describe('findByTokenHash', () => {
    it('should return the row when token hash matches', async () => {
      const row: RefreshTokenRow = {
        id: 10,
        user_id: 42,
        token_hash: 'abc123hash',
        expires_at: new Date('2026-07-01T00:00:00Z'),
        created_at: new Date('2026-06-21T00:00:00Z'),
        revoked_at: null,
      };
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [row] } as any);

      const result = await findByTokenHash(mockDb, 'abc123hash');

      expect(result).toEqual(row);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['abc123hash']
      );
    });

    it('should return undefined when token hash not found', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [] } as any);

      const result = await findByTokenHash(mockDb, 'unknown-hash');

      expect(result).toBeUndefined();
    });
  });

  describe('revokeByTokenHash', () => {
    it('should set revoked_at on the matching active token', async () => {
      await revokeByTokenHash(mockDb, 'abc123hash');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        ['abc123hash']
      );
    });
  });

  describe('revokeByUserId', () => {
    it('should revoke all active tokens for a user', async () => {
      await revokeByUserId(mockDb, 42);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [42]
      );
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired and old revoked tokens', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: '5' }],
        rowCount: 1,
      } as any);

      const count = await cleanupExpired(mockDb, 30);

      expect(count).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [30]
      );
    });

    it('should accept custom retention days', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as any);

      const count = await cleanupExpired(mockDb, 7);

      expect(count).toBe(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [7]
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should atomically revoke old and insert new token', async () => {
      const expiresAt = new Date('2026-07-01T00:00:00Z');
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

      await rotateRefreshToken(mockDb, 1, 'old-hash', 'new-hash', expiresAt);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(committed).toBe(true);
    });

    it('should throw when old token rowCount is 0', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });
        return fn({ query: clientQuery });
      });

      await expect(
        rotateRefreshToken(mockDb, 1, 'old-hash', 'new-hash', new Date())
      ).rejects.toThrow('Refresh token already consumed or invalid');
    });
  });
});
