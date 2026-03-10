import apiClient from './client';
import type { ApiResponse } from '../types';

// ============================================================================
// USER TYPES
// ============================================================================

export interface UserPublic {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
  created_at: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role_id?: number;
}

export interface UserRoleUpdate {
  role_id: number;
}

export interface PasswordResetResult {
  user: UserPublic;
  newPassword: string;
}

// ============================================================================
// USERS API FUNCTIONS
// ============================================================================

/**
 * Get all users (admin only)
 * @param params Optional pagination parameters
 * @returns Array of users without password hashes
 */
export async function getUsers(params?: {
  limit?: number;
  offset?: number
}): Promise<UserPublic[]> {
  const response = await apiClient.get<ApiResponse<UserPublic[]>>('/users', {
    params: params || {},
  });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch users');
  }

  return response.data.data;
}

/**
 * Get user by ID (admin only)
 * @param id User ID
 * @returns User without password hash
 */
export async function getUserById(id: number): Promise<UserPublic> {
  const response = await apiClient.get<ApiResponse<UserPublic>>(`/users/${id}`);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch user');
  }

  return response.data.data;
}

/**
 * Create a new user (admin only)
 * @param data User creation data (username, password, role_id)
 * @returns Created user without password hash
 */
export async function createUser(data: UserCreate): Promise<UserPublic> {
  const response = await apiClient.post<ApiResponse<UserPublic>>('/users', data);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to create user');
  }

  return response.data.data;
}

/**
 * Update user role (admin only)
 * @param id User ID
 * @param roleId New role ID (integer)
 * @returns Updated user
 */
export async function updateUserRole(id: number, roleId: number): Promise<UserPublic> {
  const response = await apiClient.put<ApiResponse<UserPublic>>(`/users/${id}/role`, { role_id: roleId });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update user role');
  }

  return response.data.data;
}

/**
 * Reset user password (admin only)
 * Generates a secure random password (16 characters)
 * @param id User ID
 * @returns User and new password (must be shown to admin immediately)
 */
export async function resetUserPassword(id: number): Promise<PasswordResetResult> {
  const response = await apiClient.post<ApiResponse<PasswordResetResult>>(`/users/${id}/reset-password`);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to reset password');
  }

  return response.data.data;
}

/**
 * Delete user (admin only)
 * Safety guards:
 * - Cannot delete self
 * - Cannot delete last admin
 * @param id User ID
 */
export async function deleteUser(id: number): Promise<void> {
  const response = await apiClient.delete<ApiResponse<void>>(`/users/${id}`);

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to delete user');
  }
}
