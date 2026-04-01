import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaasAuthService } from './saas-auth-service.js';
import type { Pool, PoolClient } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePool(queryRows: unknown[] = []): { pool: Pool; client: PoolClient & { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } } {
  const query = vi.fn().mockResolvedValue({ rows: queryRows, rowCount: queryRows.length });
  const client = { query, release: vi.fn() };
  const pool: Pool = { connect: vi.fn().mockResolvedValue(client) };
  return { pool, client };
}

const ORG = {
  id: 'org-uuid-1',
  slug: 'my-cinema',
  schema_name: 'org_my_cinema',
};

const VALID_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

// ── SaasAuthService ──────────────────────────────────────────────────────────

describe('SaasAuthService', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', VALID_JWT_SECRET);
    vi.stubEnv('JWT_EXPIRES_IN', '24h');
  });

  describe('createAdminUser', () => {
    it('sets search_path to the org schema before inserting user', async () => {
      // The INSERT query returns the new user row
      const newUser = { id: 1, username: 'admin@my-cinema.com', role_id: 1, role_name: 'admin' };
      const { pool, client } = makePool([newUser]);

      const service = new SaasAuthService(pool);
      await service.createAdminUser(ORG, 'admin@my-cinema.com', 'Password1!');

      // First query must set the search_path to the org schema
      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'SET search_path TO "org_my_cinema", public',
      );
    });

    it('inserts user into the org schema with a hashed password', async () => {
      const newUser = { id: 1, username: 'admin@my-cinema.com', role_id: 1, role_name: 'admin' };
      const { pool, client } = makePool([newUser]);

      const service = new SaasAuthService(pool);
      await service.createAdminUser(ORG, 'admin@my-cinema.com', 'Password1!');

      // Second call should be an INSERT on the users table
      const insertCall = client.query.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO users/i);
      // The plaintext password must NOT appear in the query
      expect(JSON.stringify(insertCall)).not.toContain('Password1!');
    });

    it('releases the pool client when done', async () => {
      const newUser = { id: 1, username: 'admin@my-cinema.com', role_id: 1, role_name: 'admin' };
      const { pool, client } = makePool([newUser]);

      const service = new SaasAuthService(pool);
      await service.createAdminUser(ORG, 'admin@my-cinema.com', 'Password1!');

      expect(client.release).toHaveBeenCalledOnce();
    });

    it('releases the pool client even when an error is thrown', async () => {
      const { pool, client } = makePool();
      client.query.mockRejectedValueOnce(new Error('db error'));

      const service = new SaasAuthService(pool);
      await expect(
        service.createAdminUser(ORG, 'admin@my-cinema.com', 'Password1!'),
      ).rejects.toThrow('db error');

      expect(client.release).toHaveBeenCalledOnce();
    });

    it('returns the created user with id, username, role_id, role_name', async () => {
      const newUser = { id: 42, username: 'admin@test.com', role_id: 1, role_name: 'admin' };
      const { pool } = makePool([newUser]);

      const service = new SaasAuthService(pool);
      const result = await service.createAdminUser(ORG, 'admin@test.com', 'Secure!Pass1');

      expect(result).toMatchObject({
        id: 42,
        username: 'admin@test.com',
        role_id: 1,
        role_name: 'admin',
      });
    });
  });

  describe('mintJwt', () => {
    it('returns a JWT string', () => {
      const service = new SaasAuthService({} as Pool);
      const token = service.mintJwt({
        userId: 1,
        username: 'admin@my-cinema.com',
        orgId: ORG.id,
        orgSlug: ORG.slug,
        roleId: 1,
        roleName: 'admin',
        permissions: [],
      });

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('JWT payload contains org_id and org_slug', () => {
      const service = new SaasAuthService({} as Pool);
      const token = service.mintJwt({
        userId: 1,
        username: 'admin@my-cinema.com',
        orgId: ORG.id,
        orgSlug: ORG.slug,
        roleId: 1,
        roleName: 'admin',
        permissions: [],
      });

      // Decode payload (base64url)
      const payloadB64 = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

      expect(payload.org_id).toBe(ORG.id);
      expect(payload.org_slug).toBe(ORG.slug);
      expect(payload.id).toBe(1);
      expect(payload.username).toBe('admin@my-cinema.com');
    });

    it('throws when JWT_SECRET is missing', () => {
      vi.stubEnv('JWT_SECRET', '');

      const service = new SaasAuthService({} as Pool);
      expect(() =>
        service.mintJwt({
          userId: 1,
          username: 'u',
          orgId: 'o',
          orgSlug: 's',
          roleId: 1,
          roleName: 'admin',
          permissions: [],
        }),
      ).toThrow();
    });
  });
});
