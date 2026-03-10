import { describe, it, expect } from 'vitest';
import { PermissionSchema, RoleSchema, RoleWithPermissionsSchema } from './role';

describe('Role Schemas', () => {
  describe('PermissionSchema', () => {
    it('should validate a valid permission with created_at', () => {
      const validPermission = {
        id: 1,
        name: 'users:create',
        description: 'Create users',
        category: 'users',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const result = PermissionSchema.safeParse(validPermission);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validPermission);
      }
    });

    it('should validate a permission with null description', () => {
      const permission = {
        id: 1,
        name: 'users:create',
        description: null,
        category: 'users',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(true);
    });

    it('should reject a permission without created_at', () => {
      const invalidPermission = {
        id: 1,
        name: 'users:create',
        description: 'Create users',
        category: 'users',
        // missing created_at
      };

      const result = PermissionSchema.safeParse(invalidPermission);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('created_at');
      }
    });

    it('should reject a permission with invalid types', () => {
      const invalidPermission = {
        id: '1', // should be number
        name: 'users:create',
        description: 'Create users',
        category: 'users',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const result = PermissionSchema.safeParse(invalidPermission);
      expect(result.success).toBe(false);
    });
  });

  describe('RoleSchema', () => {
    it('should validate a valid role with created_at', () => {
      const validRole = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: true,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const result = RoleSchema.safeParse(validRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validRole);
      }
    });

    it('should validate a role with null description', () => {
      const role = {
        id: 2,
        name: 'operator',
        description: null,
        is_system: true,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const result = RoleSchema.safeParse(role);
      expect(result.success).toBe(true);
    });

    it('should reject a role without created_at', () => {
      const invalidRole = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: true,
        // missing created_at
      };

      const result = RoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('created_at');
      }
    });

    it('should reject a role with invalid types', () => {
      const invalidRole = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: 'true', // should be boolean
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const result = RoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });
  });

  describe('RoleWithPermissionsSchema', () => {
    it('should validate a role with permissions array', () => {
      const roleWithPerms = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: true,
        created_at: '2024-01-15T10:30:00.000Z',
        permissions: [
          {
            id: 1,
            name: 'users:create',
            description: 'Create users',
            category: 'users',
            created_at: '2024-01-15T10:30:00.000Z',
          },
          {
            id: 2,
            name: 'users:delete',
            description: 'Delete users',
            category: 'users',
            created_at: '2024-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = RoleWithPermissionsSchema.safeParse(roleWithPerms);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions).toHaveLength(2);
      }
    });

    it('should validate a role with empty permissions array', () => {
      const roleWithoutPerms = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: true,
        created_at: '2024-01-15T10:30:00.000Z',
        permissions: [],
      };

      const result = RoleWithPermissionsSchema.safeParse(roleWithoutPerms);
      expect(result.success).toBe(true);
    });

    it('should reject a role without permissions field', () => {
      const invalidRole = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: true,
        created_at: '2024-01-15T10:30:00.000Z',
        // missing permissions
      };

      const result = RoleWithPermissionsSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });

    it('should reject a role with invalid permission in array', () => {
      const roleWithBadPerm = {
        id: 1,
        name: 'admin',
        description: 'Administrator role',
        is_system: true,
        created_at: '2024-01-15T10:30:00.000Z',
        permissions: [
          {
            id: 1,
            name: 'users:create',
            description: 'Create users',
            category: 'users',
            // missing created_at
          },
        ],
      };

      const result = RoleWithPermissionsSchema.safeParse(roleWithBadPerm);
      expect(result.success).toBe(false);
    });
  });

  describe('Type inference', () => {
    it('should infer correct TypeScript types from schemas', () => {
      // This is a compile-time test - if it compiles, types are correct
      const permission: import('./role').Permission = {
        id: 1,
        name: 'test',
        description: null,
        category: 'test',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const role: import('./role').Role = {
        id: 1,
        name: 'test',
        description: null,
        is_system: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const roleWithPerms: import('./role').RoleWithPermissions = {
        ...role,
        permissions: [permission],
      };

      expect(permission.created_at).toBeDefined();
      expect(role.created_at).toBeDefined();
      expect(roleWithPerms.created_at).toBeDefined();
      expect(roleWithPerms.permissions[0].created_at).toBeDefined();
    });
  });
});
