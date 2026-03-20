import React, { useState, useMemo, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUserRole, resetUserPassword, deleteUser } from '../../api/users';
import type { UserPublic, UserCreate } from '../../api/users';
import { rolesApi } from '../../api/roles';
import type { RoleWithPermissions } from '../../types/role';
import { AuthContext } from '../../contexts/AuthContext';
import RoleBadge from '../../components/admin/RoleBadge';
import CreateUserModal from '../../components/admin/CreateUserModal';
import DeleteUserDialog from '../../components/admin/DeleteUserDialog';
import PasswordResetDialog from '../../components/admin/PasswordResetDialog';
import Button from '../../components/ui/Button';
import LinkButton from '../../components/ui/LinkButton';

// ────────────────────────────────────────────────────────────────
// ChangeRoleModal — select a new role from a dropdown
// ────────────────────────────────────────────────────────────────
interface ChangeRoleModalProps {
  user: UserPublic;
  roles: RoleWithPermissions[];
  onClose: () => void;
  onConfirm: (userId: number, newRoleId: number) => Promise<void>;
}

const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({ user, roles, onClose, onConfirm }) => {
  const [selectedRoleId, setSelectedRoleId] = useState<number>(user.role_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(user.id, selectedRoleId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Change Role</h2>
        <p className="text-sm text-gray-600 mb-4">
          Select a new role for <strong>{user.username}</strong>
        </p>

        <label htmlFor="select-new-role" className="block text-sm font-medium text-gray-700 mb-1">
          Select new role
        </label>
        <select
          id="select-new-role"
          aria-label="Select new role"
          value={selectedRoleId}
          onChange={e => setSelectedRoleId(Number(e.target.value))}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 mb-4 disabled:bg-gray-100"
        >
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// UsersPage
// ────────────────────────────────────────────────────────────────
const UsersPage: React.FC = () => {
  const { hasPermission } = useContext(AuthContext);
  const queryClient = useQueryClient();
  
  // Permission checks
  const canCreate = hasPermission('users:create');
  const canUpdate = hasPermission('users:update');
  const canDelete = hasPermission('users:delete');

  // React Query: fetch users and roles in parallel
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getAll(),
  });

  const loading = usersLoading || rolesLoading;
  const error = usersError ? (usersError instanceof Error ? usersError.message : 'Failed to fetch users') : null;

  // Modal/dialog states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserPublic | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [passwordResetData, setPasswordResetData] = useState<{
    username: string;
    newPassword: string;
  } | null>(null);
  const [userForRoleChange, setUserForRoleChange] = useState<UserPublic | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => updateUserRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserToDelete(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete user');
    },
  });

  // Create user
  const handleCreateUser = async (data: UserCreate) => {
    await createMutation.mutateAsync(data);
  };

  // Change role
  const handleChangeRole = async (userId: number, newRoleId: number) => {
    await changeRoleMutation.mutateAsync({ userId, roleId: newRoleId });
  };

  // Reset password
  const handleResetPassword = async (userId: number) => {
    try {
      setActionError(null);
      const result = await resetUserPassword(userId);
      setPasswordResetData({
        username: result.user.username,
        newPassword: result.newPassword,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: number) => {
    setDeleteError(null);
    await deleteMutation.mutateAsync(userId);
  };

  // ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instance to prevent expensive
  // re-initialization during list renders
  const formatterDate = useMemo(() => new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }), []);

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return formatterDate.format(date);
  };

  // Build a quick role lookup for isSystem flag
  const roleMap = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)} data-testid="create-user-button">
            Create User
          </Button>
        )}
      </div>

      {/* Error Message */}
      {(error || actionError) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error || actionError}</p>
        </div>
      )}

      {/* Empty State */}
      {users.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No users found</p>
        </div>
      ) : (
        /* Users Table */
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => {
                const role = roleMap.get(user.role_id);
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadge roleName={user.role_name} isSystem={role?.is_system} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(user.created_at)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {canUpdate && (
                          <LinkButton
                            onClick={() => setUserForRoleChange(user)}
                            data-testid={`change-role-${user.id}`}
                          >
                            Change Role
                          </LinkButton>
                        )}
                        {canUpdate && (
                          <LinkButton
                            variant="warning"
                            onClick={() => handleResetPassword(user.id)}
                            data-testid={`reset-password-${user.id}`}
                          >
                            Reset Password
                          </LinkButton>
                        )}
                        {canDelete && (
                          <LinkButton
                            variant="danger"
                            onClick={() => setUserToDelete(user)}
                            data-testid={`delete-user-${user.id}`}
                          >
                            Delete
                          </LinkButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateUser}
        roles={roles}
      />

      {/* Change Role Modal */}
      {userForRoleChange && (
        <ChangeRoleModal
          user={userForRoleChange}
          roles={roles}
          onClose={() => setUserForRoleChange(null)}
          onConfirm={handleChangeRole}
        />
      )}

      {/* Delete User Dialog */}
      {userToDelete && (
        <DeleteUserDialog
          isOpen={true}
          user={userToDelete}
          onClose={() => {
            setUserToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteUser}
          isDeleting={deleteMutation.isPending}
          error={deleteError}
        />
      )}

      {/* Password Reset Dialog */}
      {passwordResetData && (
        <PasswordResetDialog
          isOpen={true}
          username={passwordResetData.username}
          newPassword={passwordResetData.newPassword}
          onClose={() => setPasswordResetData(null)}
        />
      )}
    </div>
  );
};

export default UsersPage;
