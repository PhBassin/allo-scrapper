import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth-service.js';
import * as userQueries from '../db/user-queries.js';
import * as roleQueries from '../db/role-queries.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { type DB } from '../db/client.js';
import { validatePasswordStrength } from '../utils/security.js';

vi.mock('../db/user-queries.js');
vi.mock('../db/role-queries.js');
vi.mock('bcryptjs');
vi.mock('jsonwebtoken');
vi.mock('../utils/security.js', () => ({
  validatePasswordStrength: vi.fn(() => null),
}));

describe('AuthService', () => {
  let authService: AuthService;
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validatePasswordStrength).mockReturnValue(null);
    authService = new AuthService(mockDb);
    process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
  });

  describe('login', () => {
    it('should throw error if username or password missing', async () => {
      await expect(authService.login('', 'password')).rejects.toThrow('Username and password are required');
      await expect(authService.login('user', '')).rejects.toThrow('Username and password are required');
    });

    it('should throw error if user not found', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(authService.login('unknown', 'password')).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if password does not match', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue({ id: 1, password_hash: 'hash' } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(authService.login('user', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET;
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue({ id: 1, password_hash: 'hash', role_id: 1 } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue(['users:read'] as any);

      await expect(authService.login('user', 'password')).rejects.toThrow('JWT_SECRET environment variable is not set');
    });

    it('should return token and user on success', async () => {
      const mockUser = { id: 1, username: 'user', role_id: 1, role_name: 'admin', is_system_role: true, password_hash: 'hash' };
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue(['users:read'] as any);
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any);

      const result = await authService.login('user', 'password');

      expect(result.token).toBe('mock-token');
      expect(result.user.username).toBe('user');
      expect(result.user.permissions).toEqual(['users:read']);
    });

    it('should include scope:superadmin in JWT for system admin users', async () => {
      const mockSystemAdmin = {
        id: 1,
        username: 'admin',
        role_id: 1,
        role_name: 'admin',
        is_system_role: true,
        password_hash: 'hash'
      };
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(mockSystemAdmin as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue(['users:read'] as any);
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any);

      await authService.login('admin', 'password');

      // Verify jwt.sign was called with scope: 'superadmin' in payload
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'superadmin',
          id: 1,
          username: 'admin',
          role_name: 'admin',
          is_system_role: true,
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should NOT include scope in JWT for regular admin users (is_system_role=false)', async () => {
      const mockRegularAdmin = {
        id: 2,
        username: 'orgadmin',
        role_id: 2,
        role_name: 'admin',
        is_system_role: false,
        password_hash: 'hash'
      };
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(mockRegularAdmin as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue(['users:read'] as any);
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any);

      await authService.login('orgadmin', 'password');

      // Verify jwt.sign was called WITHOUT scope in payload
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({
          scope: expect.anything(),
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should NOT include scope in JWT for non-admin system users', async () => {
      const mockSystemUser = {
        id: 3,
        username: 'systemuser',
        role_id: 3,
        role_name: 'viewer',
        is_system_role: true,
        password_hash: 'hash'
      };
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(mockSystemUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue(['schedules:read'] as any);
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any);

      await authService.login('systemuser', 'password');

      // Verify jwt.sign was called WITHOUT scope in payload
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({
          scope: expect.anything(),
        }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('register', () => {
    it('should throw error if username or password missing', async () => {
      await expect(authService.register('', 'password')).rejects.toThrow('Username and password are required');
    });

    it('should throw error if username exists', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue({ id: 1 } as any);
      await expect(authService.register('exists', 'password')).rejects.toThrow('Username already exists');
    });

    it('should return created user on success', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(bcrypt.genSalt).mockResolvedValue('salt' as any);
      vi.mocked(bcrypt.hash).mockResolvedValue('hash' as any);
      vi.mocked(userQueries.createUser).mockResolvedValue({ id: 2, username: 'new', role_id: 2, role_name: 'user' } as any);

      const result = await authService.register('new', 'password');
      expect(result.id).toBe(2);
      expect(result.username).toBe('new');
    });
  });

  describe('changePassword', () => {
    it('should throw error if currentPassword or newPassword missing', async () => {
      await expect(authService.changePassword('user', '', 'new')).rejects.toThrow('Current password and new password are required');
    });

    it('should throw error if password strength validation fails', async () => {
      const { validatePasswordStrength } = await import('../utils/security.js');
      vi.mocked(validatePasswordStrength).mockReturnValue('Weak password');
      
      await expect(authService.changePassword('user', 'old', 'weak')).rejects.toThrow('Weak password');
    });

    it('should throw error if user not found', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue(undefined);
      await expect(authService.changePassword('unknown', 'old', 'ValidPass123!')).rejects.toThrow('User not found');
    });

    it('should throw error if current password incorrect', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue({ id: 1, password_hash: 'hash' } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);
      
      await expect(authService.changePassword('user', 'wrong', 'ValidPass123!')).rejects.toThrow('Current password is incorrect');
    });

    it('should update password on success', async () => {
      vi.mocked(userQueries.getUserByUsername).mockResolvedValue({ id: 1, username: 'user', password_hash: 'old-hash' } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(bcrypt.genSalt).mockResolvedValue('salt' as any);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hash' as any);

      await authService.changePassword('user', 'old', 'ValidPass123!');
      
      expect(userQueries.updateUserPassword).toHaveBeenCalledWith(mockDb, 1, 'new-hash');
    });
  });
});
