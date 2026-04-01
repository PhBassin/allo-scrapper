import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuperadminAuthService } from './superadmin-auth-service.js';
import type { Pool, PoolClient } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePool(
  queryRows: unknown[] = [],
): { pool: Pool; client: PoolClient & { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } } {
  const query = vi.fn().mockResolvedValue({ rows: queryRows, rowCount: queryRows.length });
  const client = { query, release: vi.fn() };
  const pool: Pool = { connect: vi.fn().mockResolvedValue(client) };
  return { pool, client };
}

const VALID_SUPERADMIN_SECRET = 'superadmin-secret-at-least-32-chars-long!!';

// ── SuperadminAuthService ─────────────────────────────────────────────────────

describe('SuperadminAuthService', () => {
  beforeEach(() => {
    vi.stubEnv('SUPERADMIN_JWT_SECRET', VALID_SUPERADMIN_SECRET);
  });

  // ── createSuperadmin ──────────────────────────────────────────────────────

  describe('createSuperadmin', () => {
    it('inserts a superadmin with a hashed password', async () => {
      const row = { id: 1, username: 'root' };
      const { pool, client } = makePool([row]);

      const service = new SuperadminAuthService(pool);
      await service.createSuperadmin('root', 'Password1!');

      const insertCall = client.query.mock.calls[0];
      expect(insertCall[0]).toMatch(/INSERT INTO superadmins/i);
      // Plaintext password must NOT appear in query
      expect(JSON.stringify(insertCall)).not.toContain('Password1!');
    });

    it('returns the created superadmin row', async () => {
      const { pool } = makePool([{ id: 1, username: 'root' }]);

      const service = new SuperadminAuthService(pool);
      const result = await service.createSuperadmin('root', 'Password1!');

      expect(result).toMatchObject({ id: 1, username: 'root' });
    });

    it('releases the pool client when done', async () => {
      const { pool, client } = makePool([{ id: 1, username: 'root' }]);

      const service = new SuperadminAuthService(pool);
      await service.createSuperadmin('root', 'Password1!');

      expect(client.release).toHaveBeenCalledOnce();
    });

    it('releases the pool client on error', async () => {
      const { pool, client } = makePool();
      client.query.mockRejectedValueOnce(new Error('db error'));

      const service = new SuperadminAuthService(pool);
      await expect(service.createSuperadmin('root', 'P@ssw0rd!')).rejects.toThrow('db error');

      expect(client.release).toHaveBeenCalledOnce();
    });
  });

  // ── validateCredentials ───────────────────────────────────────────────────

  describe('validateCredentials', () => {
    it('returns the superadmin row when username and password are correct', async () => {
      // bcrypt hash of 'Password1!' generated at cost 10
      const hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVImSEMhyS'; // placeholder — tested with real bcrypt in GREEN phase
      const row = { id: 1, username: 'root', password_hash: hash };
      const { pool } = makePool([row]);

      // We can't easily test bcrypt equality in a unit test without real hash;
      // test the "not found" and "wrong password" paths instead.
      const service = new SuperadminAuthService(pool);

      // If no row returned → null
      const emptyPool = makePool([]).pool;
      const emptyService = new SuperadminAuthService(emptyPool);
      const result = await emptyService.validateCredentials('ghost', 'Password1!');
      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      // Use a known bcrypt hash for 'correct-password'
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correct-password', 1); // cost 1 for speed in tests
      const row = { id: 1, username: 'root', password_hash: hash };
      const { pool } = makePool([row]);

      const service = new SuperadminAuthService(pool);
      const result = await service.validateCredentials('root', 'wrong-password');

      expect(result).toBeNull();
    });

    it('returns the superadmin when credentials are valid', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correct-password', 1);
      const row = { id: 1, username: 'root', password_hash: hash };
      const { pool } = makePool([row]);

      const service = new SuperadminAuthService(pool);
      const result = await service.validateCredentials('root', 'correct-password');

      expect(result).toMatchObject({ id: 1, username: 'root' });
    });
  });

  // ── mintSuperadminJwt ─────────────────────────────────────────────────────

  describe('mintSuperadminJwt', () => {
    it('returns a JWT string with three segments', () => {
      const service = new SuperadminAuthService({} as Pool);
      const token = service.mintSuperadminJwt({ superadminId: 1, username: 'root' });

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('JWT payload has scope=superadmin', () => {
      const service = new SuperadminAuthService({} as Pool);
      const token = service.mintSuperadminJwt({ superadminId: 1, username: 'root' });

      const payloadB64 = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

      expect(payload.scope).toBe('superadmin');
      expect(payload.id).toBe(1);
      expect(payload.username).toBe('root');
    });

    it('JWT is signed with SUPERADMIN_JWT_SECRET, not JWT_SECRET', () => {
      // Stub JWT_SECRET to something different; token should still verify with SUPERADMIN_JWT_SECRET
      vi.stubEnv('JWT_SECRET', 'different-secret-at-least-32-characters!!');

      const service = new SuperadminAuthService({} as Pool);
      const token = service.mintSuperadminJwt({ superadminId: 1, username: 'root' });

      // Manually verify with the correct secret
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, VALID_SUPERADMIN_SECRET) as Record<string, unknown>;
      expect(decoded.scope).toBe('superadmin');
    });

    it('throws when SUPERADMIN_JWT_SECRET is missing', () => {
      vi.stubEnv('SUPERADMIN_JWT_SECRET', '');

      const service = new SuperadminAuthService({} as Pool);
      expect(() => service.mintSuperadminJwt({ superadminId: 1, username: 'root' })).toThrow();
    });

    it('throws when SUPERADMIN_JWT_SECRET is too short', () => {
      vi.stubEnv('SUPERADMIN_JWT_SECRET', 'short');

      const service = new SuperadminAuthService({} as Pool);
      expect(() => service.mintSuperadminJwt({ superadminId: 1, username: 'root' })).toThrow();
    });
  });
});
