import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRefreshTokenExpiry,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
} from './refresh-token-repository.js';
import type { DB } from '../db/index.js';
import * as dbQueries from '../db/refresh-token-queries.js';

vi.mock('../db/refresh-token-queries.js');

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
    it('should generate a raw token and store its hash via insertRefreshToken', async () => {
      vi.mocked(dbQueries.insertRefreshToken).mockResolvedValue(undefined);

      const token = await generateRefreshToken(mockDb, 1);

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(32);
      expect(dbQueries.insertRefreshToken).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should accept custom expiry', async () => {
      vi.mocked(dbQueries.insertRefreshToken).mockResolvedValue(undefined);

      const token = await generateRefreshToken(mockDb, 1, 3600_000);

      expect(token).toBeDefined();
      expect(dbQueries.insertRefreshToken).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.any(String),
        expect.any(Date),
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should return userId for valid non-expired non-revoked token', async () => {
      vi.mocked(dbQueries.findByTokenHash).mockResolvedValue({
        id: 1,
        user_id: 42,
        token_hash: 'hashed',
        expires_at: new Date('2026-06-22T12:00:00Z'), // 1 day later
        created_at: now,
        revoked_at: null,
      });

      const result = await validateRefreshToken(mockDb, 'valid-raw-token');

      expect(result).toBe(42);
      expect(dbQueries.findByTokenHash).toHaveBeenCalledWith(
        mockDb,
        expect.any(String),
      );
    });

    it('should return null for unknown token', async () => {
      vi.mocked(dbQueries.findByTokenHash).mockResolvedValue(undefined);

      const result = await validateRefreshToken(mockDb, 'unknown-token');

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      vi.mocked(dbQueries.findByTokenHash).mockResolvedValue({
        id: 1,
        user_id: 42,
        token_hash: 'hashed',
        expires_at: new Date('2026-06-22T12:00:00Z'),
        created_at: now,
        revoked_at: new Date('2026-06-20T12:00:00Z'),
      });

      const result = await validateRefreshToken(mockDb, 'revoked-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      vi.mocked(dbQueries.findByTokenHash).mockResolvedValue({
        id: 1,
        user_id: 42,
        token_hash: 'hashed',
        expires_at: new Date('2026-06-20T12:00:00Z'), // 1 day ago
        created_at: now,
        revoked_at: null,
      });

      const result = await validateRefreshToken(mockDb, 'expired-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should hash token and call revokeByTokenHash', async () => {
      vi.mocked(dbQueries.revokeByTokenHash).mockResolvedValue(undefined);

      await revokeRefreshToken(mockDb, 'token-to-revoke');

      expect(dbQueries.revokeByTokenHash).toHaveBeenCalledWith(
        mockDb,
        expect.any(String),
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should call revokeByUserId', async () => {
      vi.mocked(dbQueries.revokeByUserId).mockResolvedValue(undefined);

      await revokeAllUserTokens(mockDb, 42);

      expect(dbQueries.revokeByUserId).toHaveBeenCalledWith(mockDb, 42);
    });
  });

  describe('rotateRefreshToken', () => {
    it('should atomically revoke old and generate new token', async () => {
      vi.mocked(dbQueries.rotateRefreshTokenTx).mockResolvedValue(undefined);

      const newToken = await rotateRefreshToken(mockDb, 1, 'old-token');

      expect(newToken).toBeDefined();
      expect(newToken.length).toBeGreaterThan(32);
      expect(dbQueries.rotateRefreshTokenTx).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.any(String), // old hash
        expect.any(String), // new hash
        expect.any(Date),   // new expiry
      );
    });

    it('should accept custom expiry', async () => {
      vi.mocked(dbQueries.rotateRefreshTokenTx).mockResolvedValue(undefined);

      const newToken = await rotateRefreshToken(mockDb, 1, 'old-token', 3600_000);

      expect(newToken).toBeDefined();
      expect(dbQueries.rotateRefreshTokenTx).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.any(String),
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should propagate errors from db layer', async () => {
      vi.mocked(dbQueries.rotateRefreshTokenTx).mockRejectedValue(
        new Error('Refresh token already consumed or invalid'),
      );

      await expect(
        rotateRefreshToken(mockDb, 1, 'bad-token'),
      ).rejects.toThrow('Refresh token already consumed or invalid');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should call cleanupExpired with default 30 days', async () => {
      vi.mocked(dbQueries.cleanupExpired).mockResolvedValue(3);

      const count = await cleanupExpiredTokens(mockDb);

      expect(count).toBe(3);
      expect(dbQueries.cleanupExpired).toHaveBeenCalledWith(mockDb, 30);
    });

    it('should accept custom retention days', async () => {
      vi.mocked(dbQueries.cleanupExpired).mockResolvedValue(0);

      const count = await cleanupExpiredTokens(mockDb, 7);

      expect(count).toBe(0);
      expect(dbQueries.cleanupExpired).toHaveBeenCalledWith(mockDb, 7);
    });
  });
});
