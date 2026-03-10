import apiClient from './client';
import type { RoleWithPermissions, Permission } from '../types/role';

export const rolesApi = {
  // List all roles
  getAll: (): Promise<RoleWithPermissions[]> =>
    apiClient.get('/roles').then(r => r.data.data),

  // Create a role
  create: (data: { name: string; description?: string }): Promise<RoleWithPermissions> =>
    apiClient.post('/roles', data).then(r => r.data.data),

  // Update a role
  update: (id: number, data: { name?: string; description?: string }): Promise<RoleWithPermissions> =>
    apiClient.put(`/roles/${id}`, data).then(r => r.data.data),

  // Delete a role
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/roles/${id}`),

  // Set permissions for a role
  setPermissions: (id: number, permissionIds: number[]): Promise<RoleWithPermissions> =>
    apiClient.put(`/roles/${id}/permissions`, { permission_ids: permissionIds }).then(r => r.data.data),

  // List all available permissions
  getAllPermissions: (): Promise<Permission[]> =>
    apiClient.get('/permissions').then(r => r.data.data),
};
