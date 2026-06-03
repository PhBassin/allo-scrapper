import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { RefreshTokenService, parseRefreshTokenExpiry } from './refresh-token-service.js';
import type { DB } from '../db/client.js';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

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

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    };
    service = new RefreshTokenService(mockDb as unknown as DB);
  });

  describe('generate', () => {
    it('should generate a refresh token and store hash in DB', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const token = await service.generate(1);

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(32); // base64url of 48 bytes
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        [1, expect.any(String), expect.any(Date)]
      );
    });

    it('should accept custom expiry', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const token = await service.generate(1, 3600_000); // 1 hour

      expect(token).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        [1, expect.any(String), expect.any(Date)]
      );
    });
  });

  describe('validate', () => {
    it('should return userId for valid non-expired non-revoked token', async () => {
      const rawToken = 'test-raw-token';
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 42,
          token_hash: hashToken(rawToken),
          expires_at: new Date(Date.now() + 86400000), // 1 day from now
          revoked_at: null,
        }],
      });

      const result = await service.validate(rawToken);

      expect(result).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [expect.any(String)]
      );
    });

    it('should return null for unknown token', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.validate('unknown-token');

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 42,
          token_hash: 'hash',
          expires_at: new Date(Date.now() + 86400000),
          revoked_at: new Date(),
        }],
      });

      const result = await service.validate('revoked-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 42,
          token_hash: 'hash',
          expires_at: new Date(Date.now() - 1000), // 1 second ago
          revoked_at: null,
        }],
      });

      const result = await service.validate('expired-token');

      expect(result).toBeNull();
    });
  });

  describe('revoke', () => {
    it('should set revoked_at on matching token', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await service.revoke('some-token');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [expect.any(String)]
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all active tokens for a user', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await service.revokeAllForUser(42);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
        [42]
      );
    });
  });

  describe('cleanup', () => {
    it('should delete expired and old revoked tokens', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ count: '5' }],
      });

      const result = await service.cleanup();

      expect(result).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [30]
      );
    });

    it('should accept custom retention days', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ count: '0' }],
      });

      const result = await service.cleanup(7);

      expect(result).toBe(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [7]
      );
    });
  });

  describe('rotate', () => {
    it('should atomically revoke old token and generate new token', async () => {
      let committed = false;
      const issuedQueries: { sql: string; params: any[] }[] = [];

      mockDb.transaction.mockImplementation(async (fn) => {
        const clientQuery = vi.fn().mockImplementation((sql: string, params: any[]) => {
          issuedQueries.push({ sql, params });
          // First call: UPDATE — must return rowCount=1
          if (issuedQueries.length === 1) return Promise.resolve({ rows: [], rowCount: 1 });
          return Promise.resolve({ rows: [] });
        });
        const client = { query: clientQuery };
        const result = await fn(client);
        committed = true;
        return result;
      });

      const newToken = await service.rotate(1, 'old-raw-token');

      expect(newToken).toBeDefined();
      expect(newToken.length).toBeGreaterThan(32);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(committed).toBe(true);
      expect(issuedQueries).toHaveLength(2);
      expect(issuedQueries[0].sql).toContain('UPDATE refresh_tokens');
      expect(issuedQueries[0].sql).toContain('user_id');
      expect(issuedQueries[0].sql).toContain('revoked_at IS NULL');
      expect(issuedQueries[0].params).toEqual([expect.any(String), 1]);
      expect(issuedQueries[1].sql).toContain('INSERT INTO refresh_tokens');
    });

    it('should throw when old token is already revoked (rowCount=0)', async () => {
      mockDb.transaction.mockImplementation(async (fn) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const client = { query: clientQuery };
        return fn(client);
      });

      await expect(service.rotate(1, 'already-revoked-token'))
        .rejects.toThrow('Refresh token already consumed or invalid');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw when token belongs to a different user', async () => {
      mockDb.transaction.mockImplementation(async (fn) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const client = { query: clientQuery };
        return fn(client);
      });

      await expect(service.rotate(1, 'bobs-token'))
        .rejects.toThrow('Refresh token already consumed or invalid');
    });

    it('should rollback transaction on failure — no partial state', async () => {
      const dbError = new Error('DB connection lost');

      mockDb.transaction.mockImplementation(async () => {
        throw dbError;
      });

      await expect(service.rotate(1, 'old-raw-token')).rejects.toThrow('DB connection lost');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should accept custom expiry', async () => {
      mockDb.transaction.mockImplementation(async (fn) => {
        const clientQuery = vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValue({ rows: [] });
        return fn({ query: clientQuery });
      });

      const newToken = await service.rotate(1, 'old-token', 3600_000);

      expect(newToken).toBeDefined();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
