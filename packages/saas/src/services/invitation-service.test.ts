import { describe, it, expect, vi } from 'vitest';
import { InvitationService } from './invitation-service.js';
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

const MOCK_INVITE = {
  id: 'inv-uuid-1',
  email: 'bob@example.com',
  role_id: 2,
  token: 'secure-token-abc',
  invited_by: 1,
  accepted_at: null,
  expires_at: new Date(Date.now() + 48 * 3600_000),
  created_at: new Date(),
};

// ── InvitationService ─────────────────────────────────────────────────────────

describe('InvitationService', () => {
  describe('createInvitation', () => {
    it('sets search_path before inserting the invitation', async () => {
      const { pool, client } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      await service.createInvitation(ORG, {
        email: 'bob@example.com',
        role_id: 2,
        invited_by: 1,
      });

      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'SET search_path TO "org_my_cinema", public',
      );
    });

    it('inserts a row into the invitations table with a generated token', async () => {
      const { pool, client } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      await service.createInvitation(ORG, {
        email: 'bob@example.com',
        role_id: 2,
        invited_by: 1,
      });

      const insertCall = client.query.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO invitations/i);
      expect(insertCall[1]).toContain('bob@example.com');
    });

    it('returns the created invitation row', async () => {
      const { pool } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      const result = await service.createInvitation(ORG, {
        email: 'bob@example.com',
        role_id: 2,
        invited_by: 1,
      });

      expect(result).toMatchObject({
        email: 'bob@example.com',
        role_id: 2,
        invited_by: 1,
      });
      expect(result.token).toBeDefined();
    });

    it('sets expiry to 48 hours from now', async () => {
      const { pool, client } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      const before = Date.now();
      await service.createInvitation(ORG, { email: 'x@y.com', role_id: 2, invited_by: 1 });
      const after = Date.now();

      const insertCall = client.query.mock.calls[1];
      const expiresParam = insertCall[1].find(
        (p: unknown) => p instanceof Date,
      ) as Date | undefined;

      if (expiresParam) {
        const diff = expiresParam.getTime() - before;
        const diffMax = expiresParam.getTime() - after;
        // Should be approx 48 hours
        expect(diff).toBeGreaterThan(47 * 3600_000);
        expect(diffMax).toBeLessThan(49 * 3600_000);
      }
    });

    it('releases the pool client', async () => {
      const { pool, client } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      await service.createInvitation(ORG, { email: 'x@y.com', role_id: 2, invited_by: 1 });

      expect(client.release).toHaveBeenCalledOnce();
    });
  });

  describe('getInvitationByToken', () => {
    it('sets search_path and queries invitations by token', async () => {
      const { pool, client } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      await service.getInvitationByToken(ORG, 'secure-token-abc');

      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'SET search_path TO "org_my_cinema", public',
      );
      const selectCall = client.query.mock.calls[1];
      expect(selectCall[0]).toMatch(/SELECT/i);
      expect(selectCall[0]).toMatch(/invitations/i);
      expect(selectCall[1]).toContain('secure-token-abc');
    });

    it('returns null when no invitation matches the token', async () => {
      const { pool } = makePool([]);
      const service = new InvitationService(pool);

      const result = await service.getInvitationByToken(ORG, 'no-such-token');

      expect(result).toBeNull();
    });

    it('returns null when the invitation is expired', async () => {
      const expired = { ...MOCK_INVITE, expires_at: new Date(Date.now() - 1000) };
      const { pool } = makePool([expired]);
      const service = new InvitationService(pool);

      const result = await service.getInvitationByToken(ORG, 'expired-token');

      expect(result).toBeNull();
    });

    it('returns null when the invitation is already accepted', async () => {
      const accepted = { ...MOCK_INVITE, accepted_at: new Date() };
      const { pool } = makePool([accepted]);
      const service = new InvitationService(pool);

      const result = await service.getInvitationByToken(ORG, 'used-token');

      expect(result).toBeNull();
    });

    it('returns the invitation when valid', async () => {
      const { pool } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      const result = await service.getInvitationByToken(ORG, 'secure-token-abc');

      expect(result).toMatchObject({ email: 'bob@example.com', role_id: 2 });
    });

    it('releases the pool client', async () => {
      const { pool, client } = makePool([MOCK_INVITE]);
      const service = new InvitationService(pool);

      await service.getInvitationByToken(ORG, 'secure-token-abc');

      expect(client.release).toHaveBeenCalledOnce();
    });
  });

  describe('acceptInvitation', () => {
    it('sets search_path, inserts user, and marks invitation accepted', async () => {
      const newUser = { id: 99, username: 'bob@example.com', role_id: 2, role_name: 'user' };
      // First query (SET), second (INSERT user), third (UPDATE invitation)
      const { pool, client } = makePool([newUser]);
      client.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
        .mockResolvedValueOnce({ rows: [newUser], rowCount: 1 }) // INSERT user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE invitation

      const service = new InvitationService(pool);

      const result = await service.acceptInvitation(ORG, MOCK_INVITE, 'SecurePass1!');

      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'SET search_path TO "org_my_cinema", public',
      );
      const insertCall = client.query.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO users/i);
      const updateCall = client.query.mock.calls[2];
      expect(updateCall[0]).toMatch(/UPDATE invitations/i);
      expect(updateCall[0]).toMatch(/accepted_at/i);

      expect(result).toMatchObject({ id: 99, username: 'bob@example.com' });
    });

    it('does not store plaintext password', async () => {
      const newUser = { id: 99, username: 'bob@example.com', role_id: 2, role_name: 'user' };
      const { pool, client } = makePool([]);
      client.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [newUser], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const service = new InvitationService(pool);
      await service.acceptInvitation(ORG, MOCK_INVITE, 'SecurePass1!');

      const allArgs = JSON.stringify(client.query.mock.calls);
      expect(allArgs).not.toContain('SecurePass1!');
    });

    it('releases the pool client', async () => {
      const newUser = { id: 99, username: 'bob@example.com', role_id: 2, role_name: 'user' };
      const { pool, client } = makePool([]);
      client.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [newUser], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const service = new InvitationService(pool);
      await service.acceptInvitation(ORG, MOCK_INVITE, 'SecurePass1!');

      expect(client.release).toHaveBeenCalledOnce();
    });
  });
});
