import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

describe('requireAuth (multi-secret verification)', () => {
  const VALID_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
  const OLD_SECRET = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7';

  /** A DB whose users table holds `version` for every id (null: no such user). */
  const withDb = (req: any, version: number | null = 0) => {
    const db = { query: vi.fn().mockResolvedValue({ rows: version === null ? [] : [{ token_version: version }] }) };
    req.app = { get: (key: string) => (key === 'db' ? db : undefined) };
    return db;
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = VALID_SECRET;
    delete process.env.JWT_PREVIOUS_SECRETS;
  });

  it('should accept token from access_token cookie', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 1, username: 'test', ver: 0 }, VALID_SECRET, { algorithm: 'HS256' });
    const req = { headers: {}, cookies: { access_token: token } } as any;
    const db = withDb(req);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(1);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT token_version FROM users'), [1]);
  });

  it('should prefer access_token cookie over Authorization header', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const cookieToken = jwt.sign({ id: 1, username: 'cookie-user', ver: 0 }, VALID_SECRET, { algorithm: 'HS256' });
    const headerToken = jwt.sign({ id: 2, username: 'header-user', ver: 0 }, VALID_SECRET, { algorithm: 'HS256' });
    const req = {
      headers: { authorization: `Bearer ${headerToken}` },
      cookies: { access_token: cookieToken },
    } as any;
    withDb(req);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(1);
    expect(req.user?.username).toBe('cookie-user');
  });

  it('should reject request without Authorization header', async () => {
    const { requireAuth } = await import('./auth.js');
    const req = { headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept token signed with current secret', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 1, username: 'test', ver: 0 }, VALID_SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    withDb(req);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(1);
  });

  it('should accept token signed with previous secret', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 2, username: 'rotated', ver: 0 }, OLD_SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    withDb(req);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(2);
  });

  it('should reject token signed with unknown secret', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 3, username: 'hacker', ver: 0 }, 'unknown-secret-min-32-chars-long-here!', { algorithm: 'HS256' });
    const req = { headers: {}, cookies: { access_token: token } } as any;
    const db = withDb(req);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  describe('token version', () => {
    const reject = async (claims: Record<string, unknown>, version: number | null) => {
      const { requireAuth } = await import('./auth.js');
      const token = jwt.sign({ id: 1, username: 'test', ...claims }, VALID_SECRET, { algorithm: 'HS256' });
      const req = { headers: {}, cookies: { access_token: token } } as any;
      withDb(req, version);
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requireAuth(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    };

    it('should reject a token minted before a credential change (stale ver)', async () => {
      await reject({ ver: 0 }, 1);
    });

    it('should reject a token without a ver claim (minted before migration 027)', async () => {
      await reject({}, 0);
    });

    it('should reject a token of a deleted user', async () => {
      await reject({ ver: 0 }, null);
    });

    it('should forward a database error to the error handler', async () => {
      const { requireAuth } = await import('./auth.js');
      const token = jwt.sign({ id: 1, username: 'test', ver: 0 }, VALID_SECRET, { algorithm: 'HS256' });
      const req = { headers: {}, cookies: { access_token: token } } as any;
      const db = withDb(req);
      const failure = new Error('db down');
      db.query.mockRejectedValue(failure);
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requireAuth(req, res as any, next);

      expect(next).toHaveBeenCalledWith(failure);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

describe('isAdminUser', () => {
  it('should return true for system admin (role_name=admin, is_system_role=true)', async () => {
    const { isAdminUser } = await import('./auth.js');
    const user = { id: 1, username: 'admin', role_name: 'admin', is_system_role: true, permissions: [] };
    expect(isAdminUser(user)).toBe(true);
  });

  it('should return false for non-system role named admin (role_name=admin, is_system_role=false)', async () => {
    const { isAdminUser } = await import('./auth.js');
    const user = { id: 2, username: 'fakeadmin', role_name: 'admin', is_system_role: false, permissions: [] };
    expect(isAdminUser(user)).toBe(false);
  });

  it('should return false for regular user (role_name=operator, is_system_role=false)', async () => {
    const { isAdminUser } = await import('./auth.js');
    const user = { id: 3, username: 'operator', role_name: 'operator', is_system_role: false, permissions: ['theaters:read'] };
    expect(isAdminUser(user)).toBe(false);
  });

  it('should return false for null user', async () => {
    const { isAdminUser } = await import('./auth.js');
    expect(isAdminUser(null)).toBe(false);
  });

  it('should return false for undefined user', async () => {
    const { isAdminUser } = await import('./auth.js');
    expect(isAdminUser(undefined)).toBe(false);
  });
});
