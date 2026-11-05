import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DB } from './index.js';
import type { Role, Permission, RoleWithPermissions } from '../types/role.js';
import {
  getAllRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRoleById,
  getAllPermissions,
  getRolePermissions,
  assignPermissionsToRole,
  removePermissionsFromRole,
  setRolePermissions,
  getPermissionNamesByRoleId,
  roleExists,
  getRoleNameById,
  getRoleInUseCount,
} from './role-queries.js';

describe('Role & Permission Queries', () => {
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      // The transaction client shares the mocked query, so assertions see every statement
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockDb)),
    } as unknown as DB;
  });

  // -------------------------------------------------------------------------
  // getAllRoles
  // -------------------------------------------------------------------------
  describe('getAllRoles', () => {
    it('should return all roles with their permissions', async () => {
      const mockRoles: Role[] = [
        { id: 1, name: 'admin', description: 'Administrateur', is_system: true, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'operator', description: 'Opérateur', is_system: true, created_at: '2024-01-01T00:00:00Z' },
      ];
      const mockPermissionsForAdmin: Permission[] = [];
      const mockPermissionsForOperator: Permission[] = [
        { id: 1, name: 'scraper:trigger', description: 'Lancer un scrape global', category: 'scraper', created_at: '2024-01-01T00:00:00Z' },
      ];

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: mockRoles, rowCount: 2 } as any)
        .mockResolvedValueOnce({ rows: mockPermissionsForAdmin, rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: mockPermissionsForOperator, rowCount: 1 } as any);

      const result = await getAllRoles(mockDb);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 1, name: 'admin', permissions: [] });
      expect(result[1]).toMatchObject({ id: 2, name: 'operator', permissions: mockPermissionsForOperator });
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

    it('should bump the role holders\' token version on an actual rename, in the same statement', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await updateRole(mockDb, 3, { name: 'moderator-v2' });

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const sql = vi.mocked(mockDb.query).mock.calls[0][0] as string;
      expect(sql).toContain('UPDATE users SET token_version = token_version + 1');
      expect(sql).toContain('old.name IS DISTINCT FROM updated.name');
    });

    it('should return undefined for non-existent role', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await updateRole(mockDb, 999, { name: 'ghost' });

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // deleteRoleById
  // -------------------------------------------------------------------------
  describe('deleteRoleById', () => {
    it('should delete a role by id and return true when the row exists', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const result = await deleteRoleById(mockDb, 3);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM roles'),
        [3]
      );
    });

    it('should return false when no role matches the id (rowCount=0)', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteRoleById(mockDb, 999);

      expect(result).toBe(false);
    });

    it('should issue exactly one DELETE query and never a SELECT on roles', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await deleteRoleById(mockDb, 3);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sql] = vi.mocked(mockDb.query).mock.calls[0];
      expect(sql).toMatch(/^\s*DELETE\s+FROM\s+roles\s+WHERE\s+id\s+=\s+\$1\s*;?\s*$/i);
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

    it('should bump the token version of the role holders in the same transaction', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await setRolePermissions(mockDb, 2, [4]);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE users SET token_version = token_version + 1 WHERE role_id = $1'),
        [2]
      );
    });

    it('should not bump the token version when the permission set is unchanged', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [{ permission_id: 5 }, { permission_id: 4 }], rowCount: 2 } as any) // delete
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any);                                          // insert

      await setRolePermissions(mockDb, 2, [4, 5, 4]);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).not.toHaveBeenCalledWith(expect.stringContaining('token_version'), expect.anything());
    });

    it('should bump the token version when a permission is removed', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [{ permission_id: 4 }, { permission_id: 5 }], rowCount: 2 } as any)
        .mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await setRolePermissions(mockDb, 2, [4]);

      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE users SET token_version'),
        [2]
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
        { name: 'theaters:create' },
      ];

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [operatorRole], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: assignedPermissions, rowCount: 2 } as any);

      const result = await getPermissionNamesByRoleId(mockDb, 2);

      expect(result).toEqual(['scraper:trigger', 'theaters:create']);
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

  // -------------------------------------------------------------------------
  // roleExists
  // -------------------------------------------------------------------------
  describe('roleExists', () => {
    it('should return true when a row matches the role id', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ exists: true }],
        rowCount: 1,
      } as any);

      const result = await roleExists(mockDb, 2);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM roles'),
        [2]
      );
    });

    it('should return false when no row matches the role id', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ exists: false }],
        rowCount: 1,
      } as any);

      const result = await roleExists(mockDb, 999);

      expect(result).toBe(false);
    });

    it('should return false when the query returns no rows', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await roleExists(mockDb, 999);

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getRoleNameById
  // -------------------------------------------------------------------------
  describe('getRoleNameById', () => {
    it('should return the role name when found', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ name: 'admin' }],
        rowCount: 1,
      } as any);

      const result = await getRoleNameById(mockDb, 1);

      expect(result).toBe('admin');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT name FROM roles'),
        [1]
      );
    });

    it('should return undefined when the role does not exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getRoleNameById(mockDb, 999);

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getRoleInUseCount
  // -------------------------------------------------------------------------
  describe('getRoleInUseCount', () => {
    it('returns the number of users assigned to the role', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: '5' }],
        rowCount: 1,
      } as any);

      const result = await getRoleInUseCount(mockDb, 42);

      expect(result).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [42],
      );
    });

    it('returns 0 when no users are assigned to the role', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as any);

      const result = await getRoleInUseCount(mockDb, 7);

      expect(result).toBe(0);
    });

    it('returns 0 when the query returns no rows', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await getRoleInUseCount(mockDb, 99);

      expect(result).toBe(0);
    });

    it('throws when count is null (malformed row, not a legitimate empty result)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: null }],
        rowCount: 1,
      } as any);

      await expect(getRoleInUseCount(mockDb, 11)).rejects.toThrow(
        /getRoleInUseCount: unexpected non-numeric count from database/,
      );
    });

    it('throws when count is non-numeric (malformed row, not a legitimate empty result)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ count: 'not-a-number' }],
        rowCount: 1,
      } as any);

      await expect(getRoleInUseCount(mockDb, 13)).rejects.toThrow(
        /getRoleInUseCount: unexpected non-numeric count from database/,
      );
    });
  });
});
