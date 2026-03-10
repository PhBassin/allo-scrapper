import React, { useState } from 'react';
import type { UserCreate } from '../../api/users';
import type { RoleWithPermissions } from '../../types/role';

const DEFAULT_ROLES: Pick<RoleWithPermissions, 'id' | 'name'>[] = [
  { id: 1, name: 'admin' },
  { id: 2, name: 'user' },
];

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: UserCreate) => Promise<void>;
  roles?: RoleWithPermissions[];
}

interface FormErrors {
  username?: string;
  password?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

function validateUsername(username: string): string | null {
  if (!username) {
    return 'Username is required';
  }
  if (!USERNAME_REGEX.test(username)) {
    if (username.length < 3 || username.length > 15) {
      return 'Username must be 3-15 characters';
    }
    return 'Username must be alphanumeric';
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onCreate, roles: rolesProp }) => {
  const roles = rolesProp ?? DEFAULT_ROLES;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(roles[0]?.id ?? 0);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleUsernameBlur = () => {
    const error = validateUsername(username);
    setErrors(prev => ({ ...prev, username: error || undefined }));
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(password);
    setErrors(prev => ({ ...prev, password: error || undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);

    if (usernameError || passwordError) {
      setErrors({
        username: usernameError || undefined,
        password: passwordError || undefined,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onCreate({ username, password, role_id: roleId });

      // Reset form
      setUsername('');
      setPassword('');
      setRoleId(roles[0]?.id ?? 0);
      setErrors({});
      setSubmitError(null);

      // Close modal
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New User</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Username Field */}
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                errors.username ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter username (3-15 alphanumeric chars)"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                disabled={isSubmitting}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Min 8 chars, uppercase, lowercase, digit, special"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          {/* Role Field — dynamic dropdown */}
          <div className="mb-4">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;
