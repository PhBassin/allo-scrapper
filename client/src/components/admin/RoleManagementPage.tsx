import React, { useState, useEffect, useContext } from 'react';
import { rolesApi } from '../../api/roles';
import type { RoleWithPermissions, Permission, PermissionCategoryLabel } from '../../types/role';
import { groupPermissionsByCategory } from '../../utils/permission-grouping';
import { AuthContext } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import LinkButton from '../ui/LinkButton';

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
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
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
  categoryLabels: PermissionCategoryLabel[];
  onClose: () => void;
  onSave: (roleId: number, permissionIds: number[]) => Promise<void>;
  readOnly?: boolean;
}

const EditRolePermissionsModal: React.FC<EditRolePermissionsModalProps> = ({
  role,
  allPermissions,
  categoryLabels,
  onClose,
  onSave,
  readOnly = false,
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

  const grouped = groupPermissionsByCategory(allPermissions, categoryLabels, 'fr');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {readOnly ? 'View Permissions' : 'Edit Permissions'} — {role.name}
          </h2>
        </div>
        <div className="px-6 py-4">
          {grouped.map(({ categoryKey, displayLabel, permissions }) => (
            <div key={categoryKey} className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{displayLabel}</h3>
              <div className="space-y-1">
                {permissions.map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(perm.id)}
                      onChange={() => toggle(perm.id)}
                      disabled={readOnly}
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
          ))}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
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
  categoryLabels: PermissionCategoryLabel[];
  onClose: () => void;
  onCreate: (data: { name: string; description?: string }, permissionIds: number[]) => Promise<void>;
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({ 
  allPermissions, 
  categoryLabels,
  onClose, 
  onCreate 
}) => {
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

  const grouped = groupPermissionsByCategory(allPermissions, categoryLabels, 'fr');

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
              {grouped.map(({ categoryKey, displayLabel, permissions }) => (
                <div key={categoryKey} className="mb-3">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-1">{displayLabel}</h3>
                  <div className="space-y-1">
                    {permissions.map(perm => (
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
              ))}
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
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
  const { hasPermission } = useContext(AuthContext);
  const canCreate = hasPermission('roles:create');
  const canRead = hasPermission('roles:read');
  const canUpdate = hasPermission('roles:update');
  const canDelete = hasPermission('roles:delete');

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<PermissionCategoryLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [viewingRole, setViewingRole] = useState<RoleWithPermissions | null>(null);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleWithPermissions | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permsData, categoriesData] = await Promise.all([
        rolesApi.getAll(),
        rolesApi.getAllPermissions(),
        rolesApi.getPermissionCategoryLabels(),
      ]);
      setRoles(rolesData);
      setAllPermissions(permsData);
      setCategoryLabels(categoriesData);
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
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} data-testid="create-role-button">
            Create Role
          </Button>
        )}
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
                      {canRead && (
                        <LinkButton
                          onClick={() => setViewingRole(role)}
                          data-testid={`view-role-${role.id}`}
                        >
                          View Permissions
                        </LinkButton>
                      )}
                      {canUpdate && (
                        <LinkButton
                          onClick={() => setEditingRole(role)}
                          data-testid={`edit-role-${role.id}`}
                        >
                          Edit Permissions
                        </LinkButton>
                      )}
                      {canDelete && (
                        <LinkButton
                          variant="danger"
                          onClick={() => setDeletingRole(role)}
                          disabled={role.is_system}
                          title={role.is_system ? 'System roles cannot be deleted' : undefined}
                          data-testid={`delete-role-${role.id}`}
                        >
                          Delete
                        </LinkButton>
                      )}
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
          categoryLabels={categoryLabels}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {viewingRole && (
        <EditRolePermissionsModal
          role={viewingRole}
          allPermissions={allPermissions}
          categoryLabels={categoryLabels}
          onClose={() => setViewingRole(null)}
          onSave={handleSavePermissions}
          readOnly={true}
        />
      )}

      {editingRole && (
        <EditRolePermissionsModal
          role={editingRole}
          allPermissions={allPermissions}
          categoryLabels={categoryLabels}
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
