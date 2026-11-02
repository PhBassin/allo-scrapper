import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth-service.js';
import * as roleQueries from '../db/role-queries.js';
import * as jwtSecrets from '../utils/jwt-secrets.js';
import { type DB } from '../db/index.js';
import type { PermissionName } from '../types/role.js';

const TEST_JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

vi.mock('../db/role-queries.js');
vi.mock('../utils/jwt-secrets.js', () => ({
  getCurrentSecret: vi.fn(() => TEST_JWT_SECRET),
  invalidateSecretsCache: vi.fn(),
}));

describe('AuthService.mintAccessToken', () => {
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    vi.mocked(jwtSecrets.getCurrentSecret).mockReturnValue(TEST_JWT_SECRET);
  });

  it('produces a JWT whose verified payload carries the canonical claims', async () => {
    const auth = new AuthService(mockDb);
    vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue([
      'reports:read',
      'users:read',
    ] as PermissionName[]);

    const token = await auth.mintAccessToken(
      {
        id: 42,
        username: 'alice',
        role_id: 7,
        role_name: 'editor',
        is_system_role: false,
      },
      mockDb
    );

    const decoded = jwt.verify(token, TEST_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload & {
      id: number;
      username: string;
      role_name: string;
      is_system_role: boolean;
      permissions: PermissionName[];
    };

    expect(decoded.id).toBe(42);
    expect(decoded.username).toBe('alice');
    expect(decoded.role_name).toBe('editor');
    expect(decoded.is_system_role).toBe(false);
    expect(decoded.permissions).toEqual(['reports:read', 'users:read']);
    expect(decoded.exp).toBeTypeOf('number');
    expect(decoded.iat).toBeTypeOf('number');
  });

  it('looks up permissions via the user role id', async () => {
    const auth = new AuthService(mockDb);
    vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue([] as PermissionName[]);

    await auth.mintAccessToken(
      { id: 1, username: 'u', role_id: 9, role_name: 'r', is_system_role: true },
      mockDb
    );

    expect(roleQueries.getPermissionNamesByRoleId).toHaveBeenCalledWith(mockDb, 9);
  });

  it('signs with HS256 using the current secret', async () => {
    const auth = new AuthService(mockDb);
    vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue([] as PermissionName[]);

    const token = await auth.mintAccessToken(
      { id: 1, username: 'u', role_id: 1, role_name: 'r', is_system_role: false },
      mockDb
    );

    const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
    expect(decoded).toBeTruthy();
    const header = jwt.decode(token, { complete: true })?.header;
    expect(header?.alg).toBe('HS256');
  });

  it('expires after 15 minutes when JWT_EXPIRES_IN is unset', async () => {
    const auth = new AuthService(mockDb);
    vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue([] as PermissionName[]);

    const token = await auth.mintAccessToken(
      { id: 1, username: 'u', role_id: 1, role_name: 'r', is_system_role: false },
      mockDb
    );

    const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(15 * 60);
  });

  it('honors JWT_EXPIRES_IN when set', async () => {
    process.env.JWT_EXPIRES_IN = '2h';
    const auth = new AuthService(mockDb);
    vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue([] as PermissionName[]);

    const token = await auth.mintAccessToken(
      { id: 1, username: 'u', role_id: 1, role_name: 'r', is_system_role: false },
      mockDb
    );

    const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
    const ttl = (decoded.exp as number) - (decoded.iat as number);
    expect(ttl).toBe(2 * 60 * 60);
  });

  it('throws when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    vi.mocked(jwtSecrets.getCurrentSecret).mockImplementation(() => {
      throw new Error('JWT_SECRET environment variable is not set');
    });
    const auth = new AuthService(mockDb);

    await expect(
      auth.mintAccessToken(
        { id: 1, username: 'u', role_id: 1, role_name: 'r', is_system_role: false },
        mockDb
      )
    ).rejects.toThrow('JWT_SECRET environment variable is not set');
  });
});