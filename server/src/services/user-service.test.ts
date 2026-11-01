import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService, type ActingUser } from './user-service.js';
import * as userQueries from '../db/user-queries.js';
import * as roleQueries from '../db/role-queries.js';
import * as passwordUtils from '../utils/password.js';
import * as refreshTokenRepo from '../repositories/refresh-token-repository.js';
import { validatePasswordStrength } from '../utils/security.js';
import { type DB } from '../db/index.js';
import type { UserPublic } from '../types/user.js';

vi.mock('../db/user-queries.js');
vi.mock('../db/role-queries.js');
vi.mock('../utils/password.js');
vi.mock('../repositories/refresh-token-repository.js', () => ({
  revokeAllUserTokens: vi.fn(),
}));
vi.mock('../utils/security.js', () => ({
  validatePasswordStrength: vi.fn(() => null),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const ACTING: ActingUser = { id: 1, username: 'admin' };

const makeUser = (
  id: number,
  username: string,
  roleId: number,
  roleName: string,
  createdAt = '2024-01-01T00:00:00Z',
): UserPublic => ({
  id,
  username,
  role_id: roleId,
  role_name: roleName,
  created_at: createdAt,
});

describe('UserService', () => {
  let service: UserService;
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validatePasswordStrength).mockReturnValue(null);
    vi.mocked(passwordUtils.hashPassword).mockResolvedValue('scrypt:hashed');
    service = new UserService(mockDb);
  });

  describe('listUsers', () => {
    it('returns the paginated user list from the db layer', async () => {
      const users = [makeUser(1, 'admin', 1, 'admin'), makeUser(2, 'user1', 2, 'operator')];
      vi.mocked(userQueries.getAllUsers).mockResolvedValue(users);

      const result = await service.listUsers({ limit: 25, offset: 50 }, ACTING);

      expect(result).toEqual(users);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(mockDb, { limit: 25, offset: 50 });
    });

    it('returns an empty array when no users match', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);
      const result = await service.listUsers({ limit: 100, offset: 0 }, ACTING);
      expect(result).toEqual([]);
    });

    it('surfaces db errors to the caller without swallowing them', async () => {
      vi.mocked(userQueries.getAllUsers).mockRejectedValue(new Error('connection refused'));
      await expect(service.listUsers({ limit: 1, offset: 0 }, ACTING)).rejects.toThrow('connection refused');
    });
  });

  describe('getUserById', () => {
    it('returns the user when found', async () => {
      const user = makeUser(2, 'user1', 2, 'operator');
      vi.mocked(userQueries.getUserById).mockResolvedValue(user);

      const result = await service.getUserById(2, ACTING);

      expect(result).toEqual(user);
      expect(userQueries.getUserById).toHaveBeenCalledWith(mockDb, 2);
    });

    it('throws NotFoundError when the user does not exist', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);
      await expect(service.getUserById(999, ACTING)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'User not found',
      });
    });
  });

  describe('createUser', () => {
    const newUser = makeUser(3, 'newuser', 2, 'operator', '2024-01-03T00:00:00Z');

    it('creates the user with the supplied role', async () => {
      vi.mocked(roleQueries.roleExists).mockResolvedValue(true);
      vi.mocked(userQueries.createUser).mockResolvedValue(newUser);

      const result = await service.createUser(
        { username: 'newuser', password: 'ValidPass123!', roleId: 2 },
        ACTING,
      );

      expect(result).toEqual(newUser);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('ValidPass123!');
      expect(userQueries.createUser).toHaveBeenCalledWith(mockDb, 'newuser', 'scrypt:hashed', 2);
    });

    it('rejects when username is missing', async () => {
      await expect(
        service.createUser({ username: '', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username and password are required');
      expect(userQueries.createUser).not.toHaveBeenCalled();
    });

    it('rejects when password is missing', async () => {
      await expect(
        service.createUser({ username: 'newuser', password: '', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username and password are required');
    });

    it('rejects a username that fails the alphanumeric+length regex', async () => {
      await expect(
        service.createUser({ username: 'ab', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username must be alphanumeric and 3-15 characters long');
      await expect(
        service.createUser({ username: 'abcdefghijklmnopqrstuv', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username must be alphanumeric and 3-15 characters long');
      await expect(
        service.createUser({ username: 'user@name', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username must be alphanumeric and 3-15 characters long');
    });

    it('rejects a weak password', async () => {
      vi.mocked(validatePasswordStrength).mockReturnValue('Password must contain at least one digit');
      await expect(
        service.createUser({ username: 'newuser', password: 'NoDigits!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Password must contain at least one digit');
    });

    it('rejects a non-integer roleId', async () => {
      await expect(
        service.createUser({ username: 'newuser', password: 'ValidPass123!', roleId: NaN }, ACTING),
      ).rejects.toThrow('role_id is required and must be a valid integer');
      expect(roleQueries.roleExists).not.toHaveBeenCalled();
    });

    it('rejects an unknown roleId', async () => {
      vi.mocked(roleQueries.roleExists).mockResolvedValue(false);
      await expect(
        service.createUser({ username: 'newuser', password: 'ValidPass123!', roleId: 999 }, ACTING),
      ).rejects.toThrow('Invalid role_id: role does not exist');
    });

    it('maps a Postgres unique-violation (code 23505) to a ValidationError', async () => {
      vi.mocked(roleQueries.roleExists).mockResolvedValue(true);
      const dup: Error & { code?: string } = new Error('duplicate key value violates unique constraint');
      dup.code = '23505';
      vi.mocked(userQueries.createUser).mockRejectedValue(dup);

      await expect(
        service.createUser({ username: 'existinguser', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username already exists');
    });

    it('maps a "duplicate key" message (no SQLSTATE) to a ValidationError', async () => {
      vi.mocked(roleQueries.roleExists).mockResolvedValue(true);
      vi.mocked(userQueries.createUser).mockRejectedValue(new Error('some duplicate key situation'));

      await expect(
        service.createUser({ username: 'existinguser', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('Username already exists');
    });

    it('rethrows unrelated db errors', async () => {
      vi.mocked(roleQueries.roleExists).mockResolvedValue(true);
      vi.mocked(userQueries.createUser).mockRejectedValue(new Error('connection refused'));

      await expect(
        service.createUser({ username: 'newuser', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toThrow('connection refused');
    });

    it('rethrows when a non-object value is rejected', async () => {
      vi.mocked(roleQueries.roleExists).mockResolvedValue(true);
      vi.mocked(userQueries.createUser).mockRejectedValue('a string error');

      await expect(
        service.createUser({ username: 'newuser', password: 'ValidPass123!', roleId: 2 }, ACTING),
      ).rejects.toBe('a string error');
    });
  });

  describe('updateUserRole', () => {
    it('updates the role and returns the refreshed user', async () => {
      const target = makeUser(2, 'user1', 2, 'operator');
      const updated = makeUser(2, 'user1', 1, 'admin');
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(target);
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('admin');
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updated);

      const result = await service.updateUserRole(2, 1, ACTING);

      expect(result).toEqual(updated);
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(mockDb, 2, 1);
    });

    it('revokes the target user sessions after the role update, not the acting admin ones', async () => {
      vi.mocked(userQueries.getUserById)
        .mockResolvedValueOnce(makeUser(2, 'user1', 2, 'operator'))
        .mockResolvedValueOnce(makeUser(2, 'user1', 3, 'viewer'));
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('viewer');
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);

      await service.updateUserRole(2, 3, ACTING);

      expect(refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalledTimes(1);
      expect(refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalledWith(mockDb, 2);
      expect(vi.mocked(userQueries.updateUserRole).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(refreshTokenRepo.revokeAllUserTokens).mock.invocationCallOrder[0],
      );
    });

    it('does not revoke sessions when the role update is rejected', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(1, 'admin', 1, 'admin'));
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('operator');
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1);

      await expect(service.updateUserRole(1, 2, ACTING)).rejects.toThrow();
      expect(refreshTokenRepo.revokeAllUserTokens).not.toHaveBeenCalled();
    });

    it('does not revoke sessions when the db update fails', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('viewer');
      vi.mocked(userQueries.updateUserRole).mockRejectedValue(new Error('db down'));

      await expect(service.updateUserRole(2, 3, ACTING)).rejects.toThrow('db down');
      expect(refreshTokenRepo.revokeAllUserTokens).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the target user does not exist', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);
      await expect(service.updateUserRole(999, 1, ACTING)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
      expect(userQueries.updateUserRole).not.toHaveBeenCalled();
    });

    it('throws ValidationError when the new role does not exist', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue(undefined);
      await expect(service.updateUserRole(2, 999, ACTING)).rejects.toThrow('Invalid role_id: role does not exist');
    });

    it('throws AuthError when demoting the only admin', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(1, 'admin', 1, 'admin'));
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('operator');
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1);

      await expect(service.updateUserRole(1, 2, ACTING)).rejects.toMatchObject({
        name: 'AuthError',
        statusCode: 403,
        message: 'Cannot demote the last admin user',
      });
      expect(userQueries.updateUserRole).not.toHaveBeenCalled();
    });

    it('allows demoting an admin when others remain', async () => {
      const target = makeUser(3, 'admin2', 1, 'admin');
      const updated = makeUser(3, 'admin2', 2, 'operator');
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(target);
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('operator');
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2);
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updated);

      const result = await service.updateUserRole(3, 2, ACTING);

      expect(result.role_name).toBe('operator');
      expect(userQueries.getAdminCount).toHaveBeenCalledWith(mockDb);
    });

    it('skips the admin-count check when promoting a non-admin to admin', async () => {
      const target = makeUser(2, 'user1', 2, 'operator');
      const updated = makeUser(2, 'user1', 1, 'admin');
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(target);
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('admin');
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updated);

      await service.updateUserRole(2, 1, ACTING);

      expect(userQueries.getAdminCount).not.toHaveBeenCalled();
    });

    it('skips the admin-count check when re-assigning the same admin role', async () => {
      const target = makeUser(1, 'admin', 1, 'admin');
      const updated = makeUser(1, 'admin', 1, 'admin');
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(target);
      vi.mocked(roleQueries.getRoleNameById).mockResolvedValue('admin');
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updated);

      await service.updateUserRole(1, 1, ACTING);

      expect(userQueries.getAdminCount).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('hashes and stores the new password', async () => {
      const target = makeUser(2, 'user1', 2, 'operator');
      vi.mocked(userQueries.getUserById).mockResolvedValue(target);
      vi.mocked(userQueries.updateUserPassword).mockResolvedValue(undefined);

      const result = await service.resetPassword(2, 'BrandNewPass123!', ACTING);

      expect(result).toEqual(target);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('BrandNewPass123!');
      expect(userQueries.updateUserPassword).toHaveBeenCalledWith(mockDb, 2, 'scrypt:hashed');
    });

    it('revokes the target user sessions after storing the new password', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(userQueries.updateUserPassword).mockResolvedValue(undefined);

      await service.resetPassword(2, 'BrandNewPass123!', ACTING);

      expect(refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalledTimes(1);
      expect(refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalledWith(mockDb, 2);
      expect(vi.mocked(userQueries.updateUserPassword).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(refreshTokenRepo.revokeAllUserTokens).mock.invocationCallOrder[0],
      );
    });

    it('does not revoke sessions when the password is rejected', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(validatePasswordStrength).mockReturnValue('Password must be at least 8 characters');

      await expect(service.resetPassword(2, 'short', ACTING)).rejects.toThrow();
      expect(refreshTokenRepo.revokeAllUserTokens).not.toHaveBeenCalled();
    });

    it('rejects a missing password', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      await expect(service.resetPassword(2, undefined, ACTING)).rejects.toThrow('New password is required');
      await expect(service.resetPassword(2, '', ACTING)).rejects.toThrow('New password is required');
    });

    it('rejects a non-string password', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      await expect(service.resetPassword(2, 12345678, ACTING)).rejects.toThrow('New password is required');
    });

    it('rejects a weak password', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(validatePasswordStrength).mockReturnValue('Password must be at least 8 characters');
      await expect(service.resetPassword(2, 'short', ACTING)).rejects.toThrow(
        'Password must be at least 8 characters',
      );
    });

    it('throws NotFoundError when the target user does not exist', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);
      await expect(service.resetPassword(999, 'ValidPass123!', ACTING)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
      expect(userQueries.updateUserPassword).not.toHaveBeenCalled();
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
    });

    it('does not validate the password when the user does not exist (preserves pre-refactor order)', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);
      await expect(service.resetPassword(999, 'weak', ACTING)).rejects.toMatchObject({
        name: 'NotFoundError',
      });
      expect(validatePasswordStrength).not.toHaveBeenCalled();
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('deletes a non-admin user', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      await service.deleteUser(2, ACTING);

      expect(userQueries.deleteUser).toHaveBeenCalledWith(mockDb, 2);
    });

    it('prevents the acting admin from deleting themselves', async () => {
      await expect(service.deleteUser(1, ACTING)).rejects.toMatchObject({
        name: 'AuthError',
        statusCode: 403,
        message: 'Cannot delete your own account',
      });
      expect(userQueries.getUserById).not.toHaveBeenCalled();
      expect(userQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the target user does not exist', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);
      await expect(service.deleteUser(999, ACTING)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
      expect(userQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('throws AuthError when deleting the last admin', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'admin2', 1, 'admin'));
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1);

      await expect(service.deleteUser(2, ACTING)).rejects.toMatchObject({
        name: 'AuthError',
        statusCode: 403,
        message: 'Cannot delete the last admin user',
      });
      expect(userQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('allows deleting an admin when others remain', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(3, 'admin2', 1, 'admin'));
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2);
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      await service.deleteUser(3, ACTING);

      expect(userQueries.deleteUser).toHaveBeenCalledWith(mockDb, 3);
    });

    it('skips the admin-count check when deleting a non-admin', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      await service.deleteUser(2, ACTING);

      expect(userQueries.getAdminCount).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the underlying delete reports no row removed', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(makeUser(2, 'user1', 2, 'operator'));
      vi.mocked(userQueries.deleteUser).mockResolvedValue(false);

      await expect(service.deleteUser(2, ACTING)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });
});