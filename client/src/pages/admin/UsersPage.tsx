import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUserRole, resetUserPassword, deleteUser } from '../../api/users';
import type { UserPublic, UserCreate } from '../../api/users';
import RoleBadge from '../../components/admin/RoleBadge';
import CreateUserModal from '../../components/admin/CreateUserModal';
import DeleteUserDialog from '../../components/admin/DeleteUserDialog';
import PasswordResetDialog from '../../components/admin/PasswordResetDialog';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal/dialog states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserPublic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [passwordResetData, setPasswordResetData] = useState<{
    username: string;
    newPassword: string;
  } | null>(null);

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Create user
  const handleCreateUser = async (data: UserCreate) => {
    await createUser(data);
    setShowCreateModal(false);
    await fetchUsers();
  };

  // Change role
  const handleChangeRole = async (userId: number, currentRole: 'admin' | 'user') => {
    try {
      setError(null);
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateUserRole(userId, newRole);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  // Reset password
  const handleResetPassword = async (userId: number) => {
    try {
      setError(null);
      const result = await resetUserPassword(userId);
      setPasswordResetData({
        username: result.user.username,
        newPassword: result.newPassword,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: number) => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteUser(userId);
      setUserToDelete(null);
      await fetchUsers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Create User
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
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
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatDate(user.created_at)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleChangeRole(user.id, user.role)}
                        className="text-blue-600 hover:text-blue-900"
                        title={`Change role to ${user.role === 'admin' ? 'user' : 'admin'}`}
                      >
                        Change Role
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="text-red-600 hover:text-red-900"
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

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateUser}
      />

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
          isDeleting={isDeleting}
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
