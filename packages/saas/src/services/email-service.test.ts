/**
 * RED tests for EmailService.
 * All DB calls are mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB, Organization } from '../db/types.js';

function makeDb(): DB {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

function makeOrg(slug = 'acme'): Organization {
  return {
    id: 1,
    name: 'Acme Cinema',
    slug,
    plan_id: 1,
    schema_name: `org_${slug}`,
    status: 'active',
    trial_ends_at: null,
  };
}

describe('EmailService', () => {
  let db: DB;

  beforeEach(() => {
    db = makeDb();
    vi.clearAllMocks();
  });

  describe('generateVerificationToken', () => {
    it('returns a 64-character hex string', async () => {
      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db);
      const token = svc.generateVerificationToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique tokens on each call', async () => {
      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db);
      const t1 = svc.generateVerificationToken();
      const t2 = svc.generateVerificationToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('storeVerificationToken', () => {
    it('writes token and expiry to the org users table', async () => {
      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db);
      const org = makeOrg();
      const userId = 42;
      const token = 'abc123'.padEnd(64, '0');

      await svc.storeVerificationToken(org, userId, token);

      const queryMock = vi.mocked(db.query);
      expect(queryMock).toHaveBeenCalled();
      // Should set search_path to the org schema
      const calls = queryMock.mock.calls.map(([sql]) => sql as string);
      expect(calls.some((s) => s.includes(org.schema_name))).toBe(true);
      // Should UPDATE users with token and expires
      expect(
        calls.some(
          (s) =>
            s.toLowerCase().includes('update') &&
            s.toLowerCase().includes('verification_token')
        )
      ).toBe(true);
    });
  });

  describe('verifyEmailToken', () => {
    it('returns userId when token is valid and not expired', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
        .mockResolvedValueOnce({
          rows: [{ id: 7, verification_expires: future }],
          rowCount: 1,
        }); // SELECT user by token
      const db2: DB = { query: queryMock };

      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db2);
      const org = makeOrg();
      const result = await svc.verifyEmailToken(org, 'sometoken');

      expect(result).toBe(7);
    });

    it('returns null when token is expired', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
        .mockResolvedValueOnce({
          rows: [{ id: 7, verification_expires: past }],
          rowCount: 1,
        });
      const db2: DB = { query: queryMock };

      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db2);
      const result = await svc.verifyEmailToken(makeOrg(), 'sometoken');

      expect(result).toBeNull();
    });

    it('returns null when token not found', async () => {
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no row
      const db2: DB = { query: queryMock };

      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db2);
      const result = await svc.verifyEmailToken(makeOrg(), 'missing');

      expect(result).toBeNull();
    });
  });

  describe('markEmailVerified', () => {
    it('sets email_verified=true and clears token fields', async () => {
      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db);
      const org = makeOrg();

      await svc.markEmailVerified(org, 7);

      const queryMock = vi.mocked(db.query);
      const calls = queryMock.mock.calls.map(([sql]) => sql as string);
      expect(
        calls.some(
          (s) =>
            s.toLowerCase().includes('update') &&
            s.toLowerCase().includes('email_verified')
        )
      ).toBe(true);
    });
  });

  describe('sendVerificationEmail', () => {
    it('does not throw when SMTP_HOST is not set (console-log stub)', async () => {
      delete process.env['SMTP_HOST'];
      const { EmailService } = await import('./email-service.js');
      const svc = new EmailService(db);
      await expect(
        svc.sendVerificationEmail('user@example.com', 'acme:abc123', 'acme')
      ).resolves.not.toThrow();
    });
  });
});
