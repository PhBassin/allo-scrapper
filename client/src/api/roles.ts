import { z } from 'zod';
import apiClient from './client';
import type { RoleWithPermissions, Permission } from '../types/role';
import { RoleWithPermissionsSchema, PermissionSchema } from '../schemas/role';

/**
 * Validates API response data using Zod schemas
 * Throws descriptive error if data doesn't match expected structure
 */
function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[API Validation Error] ${context}:`, {
        issues: error.issues,
        receivedData: data,
      });
      throw new Error(
        `Invalid data received from server (${context}): ${error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        { cause: error }
      );
    }
    throw error;
  }
}

export const rolesApi = {
  // List all roles
  getAll: (): Promise<RoleWithPermissions[]> =>
    apiClient.get('/roles').then(r => 
      validateResponse(z.array(RoleWithPermissionsSchema), r.data.data, 'GET /roles')
    ),

  // Create a role
  create: (data: { name: string; description?: string }): Promise<RoleWithPermissions> =>
    apiClient.post('/roles', data).then(r => 
      validateResponse(RoleWithPermissionsSchema, r.data.data, 'POST /roles')
    ),

  // Update a role
  update: (id: number, data: { name?: string; description?: string }): Promise<RoleWithPermissions> =>
    apiClient.put(`/roles/${id}`, data).then(r => 
      validateResponse(RoleWithPermissionsSchema, r.data.data, `PUT /roles/${id}`)
    ),

  // Delete a role
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/roles/${id}`),

  // Set permissions for a role
  setPermissions: (id: number, permissionIds: number[]): Promise<RoleWithPermissions> =>
    apiClient.put(`/roles/${id}/permissions`, { permission_ids: permissionIds }).then(r => 
      validateResponse(RoleWithPermissionsSchema, r.data.data, `PUT /roles/${id}/permissions`)
    ),

  // List all available permissions
  getAllPermissions: (): Promise<Permission[]> =>
    apiClient.get('/roles/permissions').then(r => 
      validateResponse(z.array(PermissionSchema), r.data.data, 'GET /roles/permissions')
    ),
};
