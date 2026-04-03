/**
 * RED tests for SaasAuthService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const JWT_SECRET = 'test-secret-minimum-32-chars-required-for-tests-abc';

describe('SaasAuthService', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('JWT_SECRET', JWT_SECRET);
    vi.stubEnv('JWT_EXPIRES_IN', '1h');
  });

  describe('createAdminUser', () => {
    it('creates user in org schema and returns row', async () => {
      const user = { id: 1, username: 'admin@acme.com', role_id: 1, role_name: 'admin' };
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [user], rowCount: 1 }),
        release: vi.fn(),
      };
      const pool = { connect: vi.fn().mockResolvedValue(client) };
      const org = { id: 1, slug: 'acme', schema_name: 'org_acme', name: 'Acme', status: 'trial' };

      const { SaasAuthService } = await import('./saas-auth-service.js');
      const svc = new SaasAuthService(pool);
      const result = await svc.createAdminUser(org, 'admin@acme.com', 'password123');

      expect(result).toEqual(user);
      expect(pool.connect).toHaveBeenCalled();
      expect(client.release).toHaveBeenCalled();

      const calls = client.query.mock.calls.map(([sql]: [string]) => sql);
      expect(calls.some((sql) => sql.includes('SET search_path'))).toBe(true);
      expect(calls.some((sql) => sql.includes('INSERT INTO users'))).toBe(true);
    });

    it('releases client even if query throws', async () => {
      const client = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path OK
          .mockRejectedValueOnce(new Error('db error')),     // INSERT fails
        release: vi.fn(),
      };
      const pool = { connect: vi.fn().mockResolvedValue(client) };
      const org = { id: 1, slug: 'acme', schema_name: 'org_acme', name: 'Acme', status: 'trial' };

      const { SaasAuthService } = await import('./saas-auth-service.js');
      const svc = new SaasAuthService(pool);

      await expect(svc.createAdminUser(org, 'admin@acme.com', 'password')).rejects.toThrow('db error');
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe('mintJwt', () => {
    it('returns a valid JWT string', async () => {
      const { SaasAuthService } = await import('./saas-auth-service.js');
      const svc = new SaasAuthService({ connect: vi.fn() });
      const token = svc.mintJwt({
        userId: 1,
        username: 'admin@acme.com',
        orgId: 1,
        orgSlug: 'acme',
        roleId: 1,
        roleName: 'admin',
        permissions: [],
      });
      // JWT = three base64url parts separated by dots
      expect(token.split('.')).toHaveLength(3);
    });

    it('throws when JWT_SECRET is missing', async () => {
      vi.unstubAllEnvs();
      vi.stubEnv('JWT_SECRET', '');

      const { SaasAuthService } = await import('./saas-auth-service.js');
      const svc = new SaasAuthService({ connect: vi.fn() });

      expect(() =>
        svc.mintJwt({
          userId: 1, username: 'x', orgId: 1, orgSlug: 'x',
          roleId: 1, roleName: 'admin', permissions: [],
        })
      ).toThrow(/JWT_SECRET/i);
    });

    it('throws when JWT_SECRET is shorter than 32 chars', async () => {
      vi.unstubAllEnvs();
      vi.stubEnv('JWT_SECRET', 'short');

      const { SaasAuthService } = await import('./saas-auth-service.js');
      const svc = new SaasAuthService({ connect: vi.fn() });

      expect(() =>
        svc.mintJwt({
          userId: 1, username: 'x', orgId: 1, orgSlug: 'x',
          roleId: 1, roleName: 'admin', permissions: [],
        })
      ).toThrow(/JWT_SECRET/i);
    });
  });
});
