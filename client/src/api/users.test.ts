import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUserRole, 
  resetUserPassword, 
  deleteUser,
  type UserPublic,
  type UserCreate,
} from './users';
import apiClient from './client';

vi.mock('./client');

describe('Users API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should fetch all users with default pagination', async () => {
      const mockUsers: UserPublic[] = [
        { id: 1, username: 'admin', role_id: 1, role_name: 'admin', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, username: 'user1', role_id: 2, role_name: 'user', created_at: '2024-01-02T00:00:00Z' },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockUsers,
        },
      });

      const result = await getUsers();

      expect(apiClient.get).toHaveBeenCalledWith('/users', { params: {} });
      expect(result).toEqual(mockUsers);
    });

    it('should fetch users with custom pagination', async () => {
      const mockUsers: UserPublic[] = [
        { id: 3, username: 'user2', role_id: 2, role_name: 'user', created_at: '2024-01-03T00:00:00Z' },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockUsers,
        },
      });

      const result = await getUsers({ limit: 10, offset: 20 });

      expect(apiClient.get).toHaveBeenCalledWith('/users', { 
        params: { limit: 10, offset: 20 } 
      });
      expect(result).toEqual(mockUsers);
    });

    it('should throw error when API returns error', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Unauthorized',
        },
      });

      await expect(getUsers()).rejects.toThrow('Unauthorized');
    });

    it('should throw default error when API returns no error message', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: false,
        },
      });

      await expect(getUsers()).rejects.toThrow('Failed to fetch users');
    });
  });

  describe('getUserById', () => {
    it('should fetch user by ID', async () => {
      const mockUser: UserPublic = {
        id: 1,
        username: 'admin',
        role_id: 1,
        role_name: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockUser,
        },
      });

      const result = await getUserById(1);

      expect(apiClient.get).toHaveBeenCalledWith('/users/1');
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'User not found',
        },
      });

      await expect(getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const newUser: UserCreate = {
        username: 'newuser',
        password: 'SecurePass123!',
        role_id: 2,
      };

      const createdUser: UserPublic = {
        id: 3,
        username: 'newuser',
        role_id: 2,
        role_name: 'user',
        created_at: '2024-01-04T00:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: createdUser,
        },
      });

      const result = await createUser(newUser);

      expect(apiClient.post).toHaveBeenCalledWith('/users', newUser);
      expect(result).toEqual(createdUser);
    });

    it('should create user with default role when not specified', async () => {
      const newUser: UserCreate = {
        username: 'defaultuser',
        password: 'SecurePass123!',
      };

      const createdUser: UserPublic = {
        id: 4,
        username: 'defaultuser',
        role_id: 2,
        role_name: 'user',
        created_at: '2024-01-05T00:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: createdUser,
        },
      });

      const result = await createUser(newUser);

      expect(result.role_name).toBe('user');
    });

    it('should throw error when username already exists', async () => {
      const newUser: UserCreate = {
        username: 'admin',
        password: 'SecurePass123!',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Username already exists',
        },
      });

      await expect(createUser(newUser)).rejects.toThrow('Username already exists');
    });

    it('should throw error for invalid password', async () => {
      const newUser: UserCreate = {
        username: 'testuser',
        password: 'weak',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Password must be at least 8 characters',
        },
      });

      await expect(createUser(newUser)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('updateUserRole', () => {
    it('should update user role to admin', async () => {
      const updatedUser: UserPublic = {
        id: 2,
        username: 'user1',
        role_id: 1,
        role_name: 'admin',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(apiClient.put).mockResolvedValueOnce({
        data: {
          success: true,
          data: updatedUser,
        },
      });

      const result = await updateUserRole(2, 1);

      expect(apiClient.put).toHaveBeenCalledWith('/users/2/role', { role_id: 1 });
      expect(result).toEqual(updatedUser);
    });

    it('should update user role to user', async () => {
      const updatedUser: UserPublic = {
        id: 1,
        username: 'admin',
        role_id: 2,
        role_name: 'user',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.put).mockResolvedValueOnce({
        data: {
          success: true,
          data: updatedUser,
        },
      });

      const result = await updateUserRole(1, 2);

      expect(result.role_name).toBe('user');
    });

    it('should throw error when user not found', async () => {
      vi.mocked(apiClient.put).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'User not found',
        },
      });

      await expect(updateUserRole(999, 1)).rejects.toThrow('User not found');
    });
  });

  describe('resetUserPassword', () => {
    it('should reset user password and return new password', async () => {
      const mockResponse = {
        user: {
          id: 2,
          username: 'user1',
          role_id: 2,
          role_name: 'user',
          created_at: '2024-01-02T00:00:00Z',
        },
        newPassword: 'Abc123!@#$%^&*()',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockResponse,
        },
      });

      const result = await resetUserPassword(2);

      expect(apiClient.post).toHaveBeenCalledWith('/users/2/reset-password');
      expect(result).toEqual(mockResponse);
      expect(result.newPassword).toHaveLength(16);
    });

    it('should throw error when user not found', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'User not found',
        },
      });

      await expect(resetUserPassword(999)).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({
        data: {
          success: true,
        },
      });

      await deleteUser(2);

      expect(apiClient.delete).toHaveBeenCalledWith('/users/2');
    });

    it('should throw error when trying to delete self', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Cannot delete your own account',
        },
      });

      await expect(deleteUser(1)).rejects.toThrow('Cannot delete your own account');
    });

    it('should throw error when trying to delete last admin', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Cannot delete the last admin user',
        },
      });

      await expect(deleteUser(1)).rejects.toThrow('Cannot delete the last admin user');
    });

    it('should throw error when user not found', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'User not found',
        },
      });

      await expect(deleteUser(999)).rejects.toThrow('User not found');
    });
  });
});
