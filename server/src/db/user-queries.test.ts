import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DB } from './client.js';
import type { UserPublic, UserRole } from '../types/user.js';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getAdminCount,
  generateRandomPassword,
} from './user-queries.js';

describe('User Management Queries', () => {
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
  });

  describe('getAllUsers', () => {
    it('should return all users without password_hash', async () => {
      const mockUsers: UserPublic[] = [
        { id: 1, username: 'admin', role: 'admin', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, username: 'user1', role: 'user', created_at: '2024-01-02T00:00:00Z' },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({ rows: mockUsers, rowCount: 2 } as any);

      const result = await getAllUsers(mockDb);

      expect(result).toEqual(mockUsers);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, username, role, created_at'),
        [100, 0]
      );
    });

    it('should respect limit parameter', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getAllUsers(mockDb, { limit: 50 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [50, 0]
      );
    });

    it('should respect offset parameter', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getAllUsers(mockDb, { offset: 10 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [100, 10]
      );
    });

    it('should respect both limit and offset parameters', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getAllUsers(mockDb, { limit: 25, offset: 50 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [25, 50]
      );
    });

    it('should use default limit=100 when not provided', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getAllUsers(mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [100, 0]
      );
    });

    it('should return empty array when no users exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getAllUsers(mockDb);

      expect(result).toEqual([]);
    });

    it('should order users by created_at DESC', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getAllUsers(mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getUserById', () => {
    it('should return user by ID without password_hash', async () => {
      const mockUser: UserPublic = {
        id: 1,
        username: 'admin',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockUser], rowCount: 1 } as any);

      const result = await getUserById(mockDb, 1);

      expect(result).toEqual(mockUser);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, username, role, created_at FROM users WHERE id = $1',
        [1]
      );
    });

    it('should return undefined for non-existent user', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getUserById(mockDb, 999);

      expect(result).toBeUndefined();
    });

    it('should handle different user IDs', async () => {
      const mockUser: UserPublic = {
        id: 42,
        username: 'testuser',
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockUser], rowCount: 1 } as any);

      const result = await getUserById(mockDb, 42);

      expect(result?.id).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), [42]);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role to admin', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await updateUserRole(mockDb, 2, 'admin');

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['admin', 2]
      );
    });

    it('should update user role to user', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await updateUserRole(mockDb, 1, 'user');

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['user', 1]
      );
    });

    it('should throw error for invalid role', async () => {
      await expect(
        updateUserRole(mockDb, 1, 'invalid' as UserRole)
      ).rejects.toThrow('Invalid role');
    });

    it('should not call database for invalid role', async () => {
      await expect(
        updateUserRole(mockDb, 1, 'superadmin' as UserRole)
      ).rejects.toThrow();

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should delete user and return true', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const result = await deleteUser(mockDb, 2);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        [2]
      );
    });

    it('should return false for non-existent user', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteUser(mockDb, 999);

      expect(result).toBe(false);
    });

    it('should handle rowCount null', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: null } as any);

      const result = await deleteUser(mockDb, 1);

      expect(result).toBe(false);
    });

    it('should handle rowCount undefined', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: undefined } as any);

      const result = await deleteUser(mockDb, 1);

      expect(result).toBe(false);
    });
  });

  describe('getAdminCount', () => {
    it('should return correct admin count', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ count: '3' }],
        rowCount: 1,
      } as any);

      const result = await getAdminCount(mockDb);

      expect(result).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
    });

    it('should return 0 when no admins exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as any);

      const result = await getAdminCount(mockDb);

      expect(result).toBe(0);
    });

    it('should handle empty result gracefully', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await getAdminCount(mockDb);

      expect(result).toBe(0);
    });

    it('should handle count as number string', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ count: '15' }],
        rowCount: 1,
      } as any);

      const result = await getAdminCount(mockDb);

      expect(result).toBe(15);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate 16-character password', () => {
      const password = generateRandomPassword();

      expect(password).toHaveLength(16);
    });

    it('should generate different passwords on each call', () => {
      const password1 = generateRandomPassword();
      const password2 = generateRandomPassword();
      const password3 = generateRandomPassword();

      expect(password1).not.toBe(password2);
      expect(password2).not.toBe(password3);
      expect(password1).not.toBe(password3);
    });

    it('should include at least one uppercase letter', () => {
      // Test multiple times to reduce flakiness
      for (let i = 0; i < 5; i++) {
        const password = generateRandomPassword();
        expect(password).toMatch(/[A-Z]/);
      }
    });

    it('should include at least one lowercase letter', () => {
      for (let i = 0; i < 5; i++) {
        const password = generateRandomPassword();
        expect(password).toMatch(/[a-z]/);
      }
    });

    it('should include at least one digit', () => {
      for (let i = 0; i < 5; i++) {
        const password = generateRandomPassword();
        expect(password).toMatch(/[0-9]/);
      }
    });

    it('should include at least one special character', () => {
      for (let i = 0; i < 5; i++) {
        const password = generateRandomPassword();
        expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
      }
    });

    it('should meet password policy requirements (integration)', () => {
      // This tests the password against the actual validation logic
      const password = generateRandomPassword();

      // Length check
      expect(password.length).toBeGreaterThanOrEqual(8);

      // Complexity checks
      expect(password).toMatch(/[A-Z]/); // uppercase
      expect(password).toMatch(/[a-z]/); // lowercase
      expect(password).toMatch(/[0-9]/); // digit
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // special
    });

    it('should only contain valid characters', () => {
      const validChars = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/;

      for (let i = 0; i < 10; i++) {
        const password = generateRandomPassword();
        expect(password).toMatch(validChars);
      }
    });
  });
});
