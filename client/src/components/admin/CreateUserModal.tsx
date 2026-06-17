import React, { useState } from 'react';
import type { UserCreate } from '../../api/users.js';
import type { RoleWithPermissions } from '../../types/role.js';
import PasswordRequirements from '../PasswordRequirements.js';
import { validateUserForm, validateUsername, validatePassword } from '../../utils/userValidators.js';

const DEFAULT_ROLES: RoleWithPermissions[] = [
  { id: 1, name: 'admin', description: null, is_system: true, created_at: '', permissions: [] },
  { id: 2, name: 'user', description: null, is_system: true, created_at: '', permissions: [] },
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

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onCreate, roles: rolesProp }) => {
  const roles = rolesProp ?? DEFAULT_ROLES;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(roles[0]?.id ?? 0);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setUsername('');
    setPassword('');
    setRoleId(roles[0]?.id ?? 0);
    setErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateUserForm(username, password);
    if (validation.username || validation.password) {
      setErrors(validation);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onCreate({ username, password, role_id: roleId });
      reset();
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
          <UsernameField
            value={username}
            error={errors.username}
            disabled={isSubmitting}
            onChange={setUsername}
            onBlur={() => setErrors((prev) => ({ ...prev, username: validateUsername(username) || undefined }))}
          />

          <PasswordField
            value={password}
            error={errors.password}
            disabled={isSubmitting}
            showPassword={showPassword}
            onChange={setPassword}
            onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password) || undefined }))}
            onToggleVisibility={() => setShowPassword(!showPassword)}
          />

          <RoleField
            value={roleId}
            roles={roles}
            disabled={isSubmitting}
            onChange={setRoleId}
          />

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

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

interface UsernameFieldProps {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}

function UsernameField({ value, error, disabled, onChange, onBlur }: UsernameFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
        Username
      </label>
      <input
        id="username"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        placeholder="Enter username (3-15 alphanumeric chars)"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

interface PasswordFieldProps {
  value: string;
  error?: string;
  disabled: boolean;
  showPassword: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
  onToggleVisibility: () => void;
}

function PasswordField({ value, error, disabled, showPassword, onChange, onBlur, onToggleVisibility }: PasswordFieldProps) {
  const showEmptyError = error && value.length === 0;
  return (
    <div className="mb-4">
      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
            showEmptyError ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Min 8 chars, uppercase, lowercase, digit, special"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      {showEmptyError && <p className="mt-1 text-sm text-red-600">Password is required</p>}
      <PasswordRequirements password={value} />
    </div>
  );
}

interface RoleFieldProps {
  value: number;
  roles: RoleWithPermissions[];
  disabled: boolean;
  onChange: (id: number) => void;
}

function RoleField({ value, roles, disabled, onChange }: RoleFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
        Role
      </label>
      <select
        id="role"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default CreateUserModal;