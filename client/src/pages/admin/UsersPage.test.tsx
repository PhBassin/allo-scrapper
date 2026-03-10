import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from './UsersPage';
import * as usersApi from '../../api/users';
import * as rolesApi from '../../api/roles';
import type { UserPublic } from '../../api/users';
import type { RoleWithPermissions } from '../../types/role';

// Mock the APIs
vi.mock('../../api/users');
vi.mock('../../api/roles');

const mockRoles: RoleWithPermissions[] = [
  {
    id: 1,
    name: 'admin',
    description: 'Full access',
    is_system: true,
    created_at: '2024-01-01T00:00:00.000Z',
    permissions: [],
  },
  {
    id: 2,
    name: 'operator',
    description: 'Operator access',
    is_system: true,
    created_at: '2024-01-01T00:00:00.000Z',
    permissions: [],
  },
  {
    id: 3,
    name: 'viewer',
    description: 'Read only',
    is_system: false,
    created_at: '2024-01-01T00:00:00.000Z',
    permissions: [],
  },
];

describe('UsersPage', () => {
  const mockUsers: UserPublic[] = [
    {
      id: 1,
      username: 'admin',
      role_id: 1,
      role_name: 'admin',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      username: 'user1',
      role_id: 2,
      role_name: 'operator',
      created_at: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 3,
      username: 'user2',
      role_id: 3,
      role_name: 'viewer',
      created_at: '2024-01-03T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.getUsers).mockResolvedValue(mockUsers);
    vi.mocked(rolesApi.rolesApi.getAll).mockResolvedValue(mockRoles);
  });

  describe('Initial Rendering', () => {
    it('should render page title', async () => {
      render(<UsersPage />);

      expect(await screen.findByRole('heading', { name: /user management/i })).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      render(<UsersPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should fetch users and roles on mount', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalled();
        expect(rolesApi.rolesApi.getAll).toHaveBeenCalled();
      });

      expect(await screen.findByText('admin')).toBeInTheDocument();
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
    });

    it('should display "Create User" button', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });
    });
  });

  describe('User List Display', () => {
    it('should display user table with correct columns', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByRole('columnheader', { name: /username/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /created/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
    });

    it('should display role badges using role_name dynamically', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      // Should display dynamic role names
      expect(screen.getByText('👑 admin')).toBeInTheDocument();
      expect(screen.getByText('operator')).toBeInTheDocument();
      expect(screen.getByText('viewer')).toBeInTheDocument();
    });

    it('should display action buttons for each user', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      const changeRoleButtons = screen.getAllByRole('button', { name: /change role/i });
      const resetPasswordButtons = screen.getAllByRole('button', { name: /reset password/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });

      expect(changeRoleButtons.length).toBeGreaterThan(0);
      expect(resetPasswordButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Create User Flow', () => {
    it('should open create modal when "Create User" button is clicked', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create user/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new user/i })).toBeInTheDocument();
    });

    it('should show role dropdown with roles from API in create modal', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create user/i });
      await user.click(createButton);

      // Role select should have options from API
      const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
      const options = Array.from(roleSelect.options).map(o => o.text);
      expect(options).toContain('admin');
      expect(options).toContain('operator');
      expect(options).toContain('viewer');
    });

    it('should create user with role_id and refresh list on successful creation', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.createUser).mockResolvedValue({
        id: 4,
        username: 'newuser',
        role_id: 2,
        role_name: 'operator',
        created_at: '2024-01-04T00:00:00.000Z',
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create user/i });
      await user.click(createButton);

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'SecurePass123!');

      // Select operator role (id=2)
      const roleSelect = screen.getByLabelText('Role');
      await user.selectOptions(roleSelect, '2');

      const submitButton = screen.getByRole('button', { name: /^create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(usersApi.createUser).toHaveBeenCalledWith({
          username: 'newuser',
          password: 'SecurePass123!',
          role_id: 2,
        });
      });

      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Change Role Flow', () => {
    it('should call updateUserRole with role_id (integer) when role changed', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.updateUserRole).mockResolvedValue({
        ...mockUsers[1],
        role_id: 1,
        role_name: 'admin',
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      // Open role change for user1
      const changeRoleButtons = screen.getAllByRole('button', { name: /change role/i });
      await user.click(changeRoleButtons[1]);

      // A role selector dropdown/modal should appear — select a new role
      const roleSelector = await screen.findByRole('combobox', { name: /select new role/i });
      await user.selectOptions(roleSelector, '1');

      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(usersApi.updateUserRole).toHaveBeenCalledWith(2, 1);
      });
    });

    it('should display error message if role change fails', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.updateUserRole).mockRejectedValue(new Error('Cannot change last admin role'));

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      const changeRoleButtons = screen.getAllByRole('button', { name: /change role/i });
      await user.click(changeRoleButtons[0]);

      const roleSelector = await screen.findByRole('combobox', { name: /select new role/i });
      await user.selectOptions(roleSelector, '2');

      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot change last admin role/i)).toBeInTheDocument();
      });
    });
  });

  describe('Reset Password Flow', () => {
    it('should open password reset dialog when reset button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.resetUserPassword).mockResolvedValue({
        user: mockUsers[1],
        newPassword: 'NewRandomPass123!',
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      const resetButtons = screen.getAllByRole('button', { name: /reset password/i });
      await user.click(resetButtons[1]);

      await waitFor(() => {
        expect(usersApi.resetUserPassword).toHaveBeenCalledWith(2);
      });

      expect(await screen.findByRole('heading', { name: /password reset successful/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('NewRandomPass123!')).toBeInTheDocument();
    });
  });

  describe('Delete User Flow', () => {
    it('should open delete confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[1]);

      expect(screen.getByRole('heading', { name: /delete user/i })).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    it('should delete user and refresh list on confirmation', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.deleteUser).mockResolvedValue(undefined);

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[1]);

      const dialog = await screen.findByRole('heading', { name: /delete user/i });
      const dialogContainer = dialog.closest('div[class*="fixed"]') as HTMLElement;
      const confirmButton = within(dialogContainer).getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(usersApi.deleteUser).toHaveBeenCalledWith(2);
      });

      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message if fetching users fails', async () => {
      vi.mocked(usersApi.getUsers).mockRejectedValue(new Error('Failed to fetch users'));

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch users/i)).toBeInTheDocument();
      });
    });

    it('should display empty state when no users exist', async () => {
      vi.mocked(usersApi.getUsers).mockResolvedValue([]);

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      });
    });
  });
});
