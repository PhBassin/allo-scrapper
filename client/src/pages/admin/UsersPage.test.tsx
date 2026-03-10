import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from './UsersPage';
import * as usersApi from '../../api/users';
import type { UserPublic } from '../../api/users';

// Mock the users API
vi.mock('../../api/users');

describe('UsersPage', () => {
  const mockUsers: UserPublic[] = [
    {
      id: 1,
      username: 'admin',
      role: 'admin',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      username: 'user1',
      role: 'user',
      created_at: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 3,
      username: 'user2',
      role: 'user',
      created_at: '2024-01-03T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.getUsers).mockResolvedValue(mockUsers);
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

    it('should fetch and display users on mount', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalled();
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

      // Check table headers (use columnheader role to avoid matching button text)
      expect(screen.getByRole('columnheader', { name: /username/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /created/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
    });

    it('should display role badges for each user', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      // Should display role badges (1 admin, 2 users)
      expect(screen.getByText('👑 Admin')).toBeInTheDocument();
      expect(screen.getAllByText('User')).toHaveLength(2);
    });

    it('should display action buttons for each user', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      // Each user should have change role, reset password, and delete buttons
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

    it('should create user and refresh list on successful creation', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.createUser).mockResolvedValue({
        id: 4,
        username: 'newuser',
        role: 'user',
        created_at: '2024-01-04T00:00:00.000Z',
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create user/i });
      await user.click(createButton);

      // Fill form
      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'SecurePass123!');

      const submitButton = screen.getByRole('button', { name: /^create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(usersApi.createUser).toHaveBeenCalledWith({
          username: 'newuser',
          password: 'SecurePass123!',
          role: 'user',
        });
      });

      // Should refresh user list
      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalledTimes(2);
      });
    });

    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create user/i });
      await user.click(createButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('heading', { name: /create new user/i })).not.toBeInTheDocument();
    });
  });

  describe('Change Role Flow', () => {
    it('should update user role when change role button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.updateUserRole).mockResolvedValue({
        ...mockUsers[1],
        role: 'admin',
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      // Find change role button for user1 (second user)
      const changeRoleButtons = screen.getAllByRole('button', { name: /change role/i });
      await user.click(changeRoleButtons[1]);

      await waitFor(() => {
        expect(usersApi.updateUserRole).toHaveBeenCalledWith(2, 'admin');
      });

      // Should refresh user list
      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalledTimes(2);
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

      // Should show password reset dialog
      expect(await screen.findByRole('heading', { name: /password reset successful/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('NewRandomPass123!')).toBeInTheDocument();
    });

    it('should display error message if password reset fails', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.resetUserPassword).mockRejectedValue(new Error('User not found'));

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      const resetButtons = screen.getAllByRole('button', { name: /reset password/i });
      await user.click(resetButtons[1]);

      await waitFor(() => {
        expect(screen.getByText(/user not found/i)).toBeInTheDocument();
      });
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

      // Wait for dialog to appear and query button within it
      const dialog = await screen.findByRole('heading', { name: /delete user/i });
      const dialogContainer = dialog.closest('div[class*="fixed"]') as HTMLElement;
      const confirmButton = within(dialogContainer).getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(usersApi.deleteUser).toHaveBeenCalledWith(2);
      });

      // Should refresh user list
      await waitFor(() => {
        expect(usersApi.getUsers).toHaveBeenCalledTimes(2);
      });
    });

    it('should display error message if delete fails', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.deleteUser).mockRejectedValue(new Error('Cannot delete last admin'));

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Wait for dialog to appear and query button within it
      const dialog = await screen.findByRole('heading', { name: /delete user/i });
      const dialogContainer = dialog.closest('div[class*="fixed"]') as HTMLElement;
      const confirmButton = within(dialogContainer).getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot delete last admin/i)).toBeInTheDocument();
      });
    });

    it('should close delete dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[1]);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('heading', { name: /delete user/i })).not.toBeInTheDocument();
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
