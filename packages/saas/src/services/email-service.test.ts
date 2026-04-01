import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from './email-service.js';
import type { Pool, PoolClient } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePool(queryRows: unknown[] = []): {
  pool: Pool;
  client: PoolClient & { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
} {
  const query = vi.fn().mockResolvedValue({ rows: queryRows, rowCount: queryRows.length });
  const client = { query, release: vi.fn() };
  const pool: Pool = { connect: vi.fn().mockResolvedValue(client) };
  return { pool, client };
}

const ORG = { id: 'org-uuid-1', slug: 'my-cinema', schema_name: 'org_my_cinema' };

// ── EmailService ──────────────────────────────────────────────────────────────

describe('EmailService', () => {
  describe('generateVerificationToken', () => {
    it('returns a non-empty string token', () => {
      const service = new EmailService({} as Pool);
      const token = service.generateVerificationToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    it('returns unique tokens on each call', () => {
      const service = new EmailService({} as Pool);
      const t1 = service.generateVerificationToken();
      const t2 = service.generateVerificationToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('storeVerificationToken', () => {
    it('sets search_path to the org schema before updating the user', async () => {
      const { pool, client } = makePool([]);
      const service = new EmailService(pool);

      await service.storeVerificationToken(ORG, 1, 'abc-token');

      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'SET search_path TO "org_my_cinema", public',
      );
    });

    it('issues an UPDATE on the users table with the token and expiry', async () => {
      const { pool, client } = makePool([]);
      const service = new EmailService(pool);

      await service.storeVerificationToken(ORG, 1, 'abc-token');

      const updateCall = client.query.mock.calls[1];
      expect(updateCall[0]).toMatch(/UPDATE users/i);
      expect(updateCall[0]).toMatch(/verification_token/i);
      expect(updateCall[0]).toMatch(/verification_expires/i);
      // token value must appear in params
      expect(updateCall[1]).toContain('abc-token');
    });

    it('releases the pool client after storing the token', async () => {
      const { pool, client } = makePool([]);
      const service = new EmailService(pool);

      await service.storeVerificationToken(ORG, 1, 'abc-token');

      expect(client.release).toHaveBeenCalledOnce();
    });

    it('releases the pool client even on error', async () => {
      const { pool, client } = makePool([]);
      client.query.mockRejectedValueOnce(new Error('db error'));

      const service = new EmailService(pool);
      await expect(service.storeVerificationToken(ORG, 1, 'bad')).rejects.toThrow('db error');

      expect(client.release).toHaveBeenCalledOnce();
    });
  });

  describe('verifyEmailToken', () => {
    it('returns the user_id when the token is valid and not expired', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();
      const { pool } = makePool([{ user_id: 42, expires_at: futureDate }]);
      const service = new EmailService(pool);

      const userId = await service.verifyEmailToken(ORG, 'valid-token');

      expect(userId).toBe(42);
    });

    it('returns null when no row matches the token', async () => {
      const { pool } = makePool([]); // empty result
      const service = new EmailService(pool);

      const userId = await service.verifyEmailToken(ORG, 'unknown-token');

      expect(userId).toBeNull();
    });

    it('returns null when the token is expired', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const { pool } = makePool([{ user_id: 42, expires_at: pastDate }]);
      const service = new EmailService(pool);

      const userId = await service.verifyEmailToken(ORG, 'expired-token');

      expect(userId).toBeNull();
    });

    it('sets search_path before querying', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();
      const { pool, client } = makePool([{ user_id: 7, expires_at: futureDate }]);
      const service = new EmailService(pool);

      await service.verifyEmailToken(ORG, 'some-token');

      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'SET search_path TO "org_my_cinema", public',
      );
    });

    it('releases the pool client after verifying', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();
      const { pool, client } = makePool([{ user_id: 7, expires_at: futureDate }]);
      const service = new EmailService(pool);

      await service.verifyEmailToken(ORG, 'some-token');

      expect(client.release).toHaveBeenCalledOnce();
    });
  });

  describe('markEmailVerified', () => {
    it('issues an UPDATE to set email_verified=true and clear the token', async () => {
      const { pool, client } = makePool([]);
      const service = new EmailService(pool);

      await service.markEmailVerified(ORG, 42);

      const updateCall = client.query.mock.calls[1]; // after SET search_path
      expect(updateCall[0]).toMatch(/UPDATE users/i);
      expect(updateCall[0]).toMatch(/email_verified/i);
      // user_id param must be present
      expect(updateCall[1]).toContain(42);
    });

    it('releases the pool client after marking verified', async () => {
      const { pool, client } = makePool([]);
      const service = new EmailService(pool);

      await service.markEmailVerified(ORG, 42);

      expect(client.release).toHaveBeenCalledOnce();
    });
  });

  describe('sendVerificationEmail', () => {
    it('resolves without throwing (no-op stub — no SMTP required)', async () => {
      const service = new EmailService({} as Pool);
      await expect(
        service.sendVerificationEmail('admin@my-cinema.com', 'abc-token', ORG.slug),
      ).resolves.not.toThrow();
    });
  });
});
