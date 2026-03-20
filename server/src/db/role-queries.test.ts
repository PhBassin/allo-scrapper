import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DB } from './client.js';
import type { Role, Permission, RoleWithPermissions } from '../types/role.js';
import {
  getAllRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  getRolePermissions,
  assignPermissionsToRole,
  removePermissionsFromRole,
  setRolePermissions,
  getPermissionNamesByRoleId,
} from './role-queries.js';

describe('Role & Permission Queries', () => {
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
  });

  // -------------------------------------------------------------------------
  // getAllRoles
  // -------------------------------------------------------------------------
  describe('getAllRoles', () => {
    it('should return all roles with their permissions', async () => {
      // Single JOIN query returns flattened rows: role columns + permission columns (prefixed p_)
      const mockJoinRows = [
        // admin has no permissions → p_* columns are null
        { id: 1, name: 'admin', description: 'Administrateur', is_system: true, created_at: '2024-01-01T00:00:00Z', p_id: null, p_name: null, p_description: null, p_category: null, p_created_at: null },
        // operator has one permission
        { id: 2, name: 'operator', description: 'Opérateur', is_system: true, created_at: '2024-01-01T00:00:00Z', p_id: 1, p_name: 'scraper:trigger', p_description: 'Lancer un scrape global', p_category: 'scraper', p_created_at: '2024-01-01T00:00:00Z' },
      ];

      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: mockJoinRows, rowCount: 2 } as any);

      const result = await getAllRoles(mockDb);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 1, name: 'admin', permissions: [] });
      expect(result[1]).toMatchObject({
        id: 2,
        name: 'operator',
        permissions: [{ id: 1, name: 'scraper:trigger', description: 'Lancer un scrape global', category: 'scraper', created_at: '2024-01-01T00:00:00Z' }],
      });
    });

    it('should return empty array when no roles exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getAllRoles(mockDb);

      expect(result).toEqual([]);
    });

    it('should query roles table', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getAllRoles(mockDb);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM roles'),
        expect.anything()
      );
    });
  });

  // -------------------------------------------------------------------------
  // getRoleById
  // -------------------------------------------------------------------------
  describe('getRoleById', () => {
    it('should return role with permissions when found', async () => {
      const mockRole: Role = {
        id: 1, name: 'admin', description: 'Administrateur', is_system: true, created_at: '2024-01-01T00:00:00Z',
      };
      const mockPermissions: Permission[] = [];

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [mockRole], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: mockPermissions, rowCount: 0 } as any);

      const result = await getRoleById(mockDb, 1);

      expect(result).toMatchObject({ id: 1, name: 'admin', permissions: [] });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM roles'),
        [1]
      );
    });

    it('should return undefined for non-existent role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getRoleById(mockDb, 999);

      expect(result).toBeUndefined();
    });

    it('should not query permissions if role not found', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getRoleById(mockDb, 999);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getRoleByName
  // -------------------------------------------------------------------------
  describe('getRoleByName', () => {
    it('should return role when found by name', async () => {
      const mockRole: Role = {
        id: 1, name: 'admin', description: 'Administrateur', is_system: true, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRole], rowCount: 1 } as any);

      const result = await getRoleByName(mockDb, 'admin');

      expect(result).toEqual(mockRole);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM roles'),
        ['admin']
      );
    });

    it('should return undefined for non-existent role name', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getRoleByName(mockDb, 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // createRole
  // -------------------------------------------------------------------------
  describe('createRole', () => {
    it('should create a role and return the created object', async () => {
      const newRole: Role = {
        id: 3, name: 'moderator', description: 'Modérateur', is_system: false, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [newRole], rowCount: 1 } as any);

      const result = await createRole(mockDb, { name: 'moderator', description: 'Modérateur' });

      expect(result).toEqual(newRole);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO roles'),
        expect.arrayContaining(['moderator'])
      );
    });

    it('should create a role without description', async () => {
      const newRole: Role = {
        id: 4, name: 'viewer', description: null, is_system: false, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [newRole], rowCount: 1 } as any);

      const result = await createRole(mockDb, { name: 'viewer' });

      expect(result).toEqual(newRole);
    });
  });

  // -------------------------------------------------------------------------
  // updateRole
  // -------------------------------------------------------------------------
  describe('updateRole', () => {
    it('should update role name and return updated object', async () => {
      const updatedRole: Role = {
        id: 3, name: 'moderator-v2', description: 'Modérateur v2', is_system: false, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [updatedRole], rowCount: 1 } as any);

      const result = await updateRole(mockDb, 3, { name: 'moderator-v2', description: 'Modérateur v2' });

      expect(result).toEqual(updatedRole);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE roles'),
        expect.arrayContaining([3])
      );
    });

    it('should return undefined for non-existent role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await updateRole(mockDb, 999, { name: 'ghost' });

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // deleteRole
  // -------------------------------------------------------------------------
  describe('deleteRole', () => {
    it('should delete a non-system role and return true', async () => {
      const mockRole: Role = {
        id: 3, name: 'moderator', description: null, is_system: false, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [mockRole], rowCount: 1 } as any)  // lookup
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);           // delete

      const result = await deleteRole(mockDb, 3);

      expect(result).toBe(true);
    });

    it('should return false if role is a system role (is_system=true)', async () => {
      const systemRole: Role = {
        id: 1, name: 'admin', description: 'Administrateur', is_system: true, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [systemRole], rowCount: 1 } as any);

      const result = await deleteRole(mockDb, 1);

      expect(result).toBe(false);
    });

    it('should return false for non-existent role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteRole(mockDb, 999);

      expect(result).toBe(false);
    });

    it('should not issue DELETE query for system roles', async () => {
      const systemRole: Role = {
        id: 1, name: 'admin', description: null, is_system: true, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rows: [systemRole], rowCount: 1 } as any);

      await deleteRole(mockDb, 1);

      // Only lookup query should have been called, not a DELETE
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getAllPermissions
  // -------------------------------------------------------------------------
  describe('getAllPermissions', () => {
    it('should return all permissions', async () => {
      const mockPermissions: Permission[] = [
        { id: 1, name: 'users:list', description: 'Lister les utilisateurs', category: 'users', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'scraper:trigger', description: 'Lancer un scrape global', category: 'scraper', created_at: '2024-01-01T00:00:00Z' },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({ rows: mockPermissions, rowCount: 2 } as any);

      const result = await getAllPermissions(mockDb);

      expect(result).toEqual(mockPermissions);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM permissions'),
        expect.anything()
      );
    });

    it('should return empty array when no permissions exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getAllPermissions(mockDb);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getRolePermissions
  // -------------------------------------------------------------------------
  describe('getRolePermissions', () => {
    it('should return permissions for a role', async () => {
      const mockPermissions: Permission[] = [
        { id: 1, name: 'scraper:trigger', description: 'Lancer un scrape global', category: 'scraper', created_at: '2024-01-01T00:00:00Z' },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({ rows: mockPermissions, rowCount: 1 } as any);

      const result = await getRolePermissions(mockDb, 2);

      expect(result).toEqual(mockPermissions);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('role_permissions'),
        [2]
      );
    });

    it('should return empty array for role with no permissions', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getRolePermissions(mockDb, 1);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // assignPermissionsToRole
  // -------------------------------------------------------------------------
  describe('assignPermissionsToRole', () => {
    it('should assign multiple permissions to a role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 3 } as any);

      await assignPermissionsToRole(mockDb, 2, [1, 2, 3]);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO role_permissions'),
        expect.arrayContaining([2])
      );
    });

    it('should do nothing when permissionIds is empty', async () => {
      await assignPermissionsToRole(mockDb, 2, []);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // removePermissionsFromRole
  // -------------------------------------------------------------------------
  describe('removePermissionsFromRole', () => {
    it('should remove specific permissions from a role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 2 } as any);

      await removePermissionsFromRole(mockDb, 2, [1, 2]);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM role_permissions'),
        expect.arrayContaining([2])
      );
    });

    it('should do nothing when permissionIds is empty', async () => {
      await removePermissionsFromRole(mockDb, 2, []);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // setRolePermissions
  // -------------------------------------------------------------------------
  describe('setRolePermissions', () => {
    it('should replace all permissions for a role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await setRolePermissions(mockDb, 2, [4, 5, 6]);

      // Should delete existing and then insert new
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM role_permissions'),
        expect.arrayContaining([2])
      );
    });

    it('should delete all permissions when given empty array', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await setRolePermissions(mockDb, 2, []);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM role_permissions'),
        [2]
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPermissionNamesByRoleId
  // -------------------------------------------------------------------------
  describe('getPermissionNamesByRoleId', () => {
    it('should return all permission names for admin role (is_system admin bypass)', async () => {
      // First query: role lookup → admin is_system=true and name='admin'
      // Second query: all permissions
      const adminRole: Role = {
        id: 1, name: 'admin', description: 'Administrateur', is_system: true, created_at: '2024-01-01T00:00:00Z',
      };
      const allPermissions = [
        { name: 'users:list' },
        { name: 'scraper:trigger' },
        { name: 'settings:read' },
      ];

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [adminRole], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: allPermissions, rowCount: 3 } as any);

      const result = await getPermissionNamesByRoleId(mockDb, 1);

      expect(result).toEqual(['users:list', 'scraper:trigger', 'settings:read']);
    });

    it('should return only assigned permissions for non-admin roles', async () => {
      const operatorRole: Role = {
        id: 2, name: 'operator', description: 'Opérateur', is_system: true, created_at: '2024-01-01T00:00:00Z',
      };
      const assignedPermissions = [
        { name: 'scraper:trigger' },
        { name: 'cinemas:create' },
      ];

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [operatorRole], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: assignedPermissions, rowCount: 2 } as any);

      const result = await getPermissionNamesByRoleId(mockDb, 2);

      expect(result).toEqual(['scraper:trigger', 'cinemas:create']);
    });

    it('should return empty array for role with no permissions', async () => {
      const customRole: Role = {
        id: 3, name: 'custom', description: null, is_system: false, created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [customRole], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await getPermissionNamesByRoleId(mockDb, 3);

      expect(result).toEqual([]);
    });

    it('should return empty array if role not found', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getPermissionNamesByRoleId(mockDb, 999);

      expect(result).toEqual([]);
    });
  });
});
