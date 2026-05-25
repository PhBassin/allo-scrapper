import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { RefreshTokenService } from './refresh-token-service.js';
import type { DB } from '../db/client.js';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
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
});
