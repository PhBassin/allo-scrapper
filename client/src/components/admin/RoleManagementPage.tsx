import React, { useState, useEffect } from 'react';
import { rolesApi } from '../../api/roles';
import type { RoleWithPermissions, Permission } from '../../types/role';

// Permission categories for grouped display
const PERMISSION_CATEGORIES: Record<string, string[]> = {
  Utilisateurs: ['users:list', 'users:create', 'users:update', 'users:delete'],
  Scraping: ['scraper:trigger', 'scraper:trigger_single'],
  Cinémas: ['cinemas:create', 'cinemas:update', 'cinemas:delete'],
  Paramètres: ['settings:read', 'settings:update', 'settings:reset', 'settings:export', 'settings:import'],
  Rapports: ['reports:list', 'reports:view'],
  Système: ['system:info', 'system:health', 'system:migrations'],
};

// ────────────────────────────────────────────────────────────────
// DeleteRoleDialog
// ────────────────────────────────────────────────────────────────
interface DeleteRoleDialogProps {
  role: RoleWithPermissions;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DeleteRoleDialog: React.FC<DeleteRoleDialogProps> = ({ role, onClose, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete Role</h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete the role <strong>{role.name}</strong>? This action cannot be undone.
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// EditRolePermissionsModal
// ────────────────────────────────────────────────────────────────
interface EditRolePermissionsModalProps {
  role: RoleWithPermissions;
  allPermissions: Permission[];
  onClose: () => void;
  onSave: (roleId: number, permissionIds: number[]) => Promise<void>;
}

const EditRolePermissionsModal: React.FC<EditRolePermissionsModalProps> = ({
  role,
  allPermissions,
  onClose,
  onSave,
}) => {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(role.permissions.map(p => p.id))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(role.id, Array.from(selected));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const permissionsByName = new Map(allPermissions.map(p => [p.name, p]));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Permissions — {role.name}
          </h2>
        </div>
        <div className="px-6 py-4">
          {Object.entries(PERMISSION_CATEGORIES).map(([category, permNames]) => {
            const perms = permNames
              .map(name => permissionsByName.get(name))
              .filter((p): p is Permission => !!p);
            if (perms.length === 0) return null;
            return (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{category}</h3>
                <div className="space-y-1">
                  {perms.map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(perm.id)}
                        onChange={() => toggle(perm.id)}
                        className="rounded"
                      />
                      <span className="font-mono text-xs">{perm.name}</span>
                      {perm.description && (
                        <span className="text-gray-400">— {perm.description}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// CreateRoleModal
// ────────────────────────────────────────────────────────────────
interface CreateRoleModalProps {
  allPermissions: Permission[];
  onClose: () => void;
  onCreate: (data: { name: string; description?: string }, permissionIds: number[]) => Promise<void>;
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({ allPermissions, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(
        { name: name.trim(), description: description.trim() || undefined },
        Array.from(selected)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const permissionsByName = new Map(allPermissions.map(p => [p.name, p]));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Create Role</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <div className="mb-4">
              <label htmlFor="role-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="role-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="e.g. operator"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="role-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                id="role-description"
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Short description of this role"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Permissions</p>
              {Object.entries(PERMISSION_CATEGORIES).map(([category, permNames]) => {
                const perms = permNames
                  .map(n => permissionsByName.get(n))
                  .filter((p): p is Permission => !!p);
                if (perms.length === 0) return null;
                return (
                  <div key={category} className="mb-3">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-1">{category}</h3>
                    <div className="space-y-1">
                      {perms.map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(perm.id)}
                            onChange={() => toggle(perm.id)}
                            className="rounded"
                          />
                          <span className="font-mono text-xs">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// RoleManagementPage (main)
// ────────────────────────────────────────────────────────────────
const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleWithPermissions | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permsData] = await Promise.all([
        rolesApi.getAll(),
        rolesApi.getAllPermissions(),
      ]);
      setRoles(rolesData);
      setAllPermissions(permsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (
    data: { name: string; description?: string },
    permissionIds: number[]
  ) => {
    try {
      const created = await rolesApi.create(data);
      if (permissionIds.length > 0) {
        await rolesApi.setPermissions(created.id, permissionIds);
      }
      await fetchData();
    } catch (error) {
      console.error('Failed to create role:', error);
      throw error; // Re-throw to be caught by ErrorBoundary
    }
  };

  const handleSavePermissions = async (roleId: number, permissionIds: number[]) => {
    try {
      await rolesApi.setPermissions(roleId, permissionIds);
      await fetchData();
    } catch (error) {
      console.error('Failed to update role permissions:', error);
      throw error; // Re-throw to be caught by ErrorBoundary
    }
  };

  const handleDelete = async (roleId: number) => {
    try {
      await rolesApi.delete(roleId);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw error; // Re-throw to be caught by ErrorBoundary
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-gray-600">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Create Role
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Roles Table */}
      {roles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No roles found</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roles.map(role => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{role.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{role.description ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.is_system ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        System
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{role.permissions.length}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingRole(role)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit Permissions
                      </button>
                      <button
                        onClick={() => setDeletingRole(role)}
                        disabled={role.is_system}
                        className="text-red-600 hover:text-red-900 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={role.is_system ? 'System roles cannot be deleted' : undefined}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateRoleModal
          allPermissions={allPermissions}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {editingRole && (
        <EditRolePermissionsModal
          role={editingRole}
          allPermissions={allPermissions}
          onClose={() => setEditingRole(null)}
          onSave={handleSavePermissions}
        />
      )}

      {deletingRole && (
        <DeleteRoleDialog
          role={deletingRole}
          onClose={() => setDeletingRole(null)}
          onConfirm={() => handleDelete(deletingRole.id)}
        />
      )}
    </div>
  );
};

export default RoleManagementPage;
