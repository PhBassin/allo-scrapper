import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateUserModal from './CreateUserModal';

describe('CreateUserModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <CreateUserModal
          isOpen={false}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      expect(screen.queryByText(/create new user/i)).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      expect(screen.getByText(/create new user/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Role')).toBeInTheDocument();
    });

    it('should render form fields with initial empty values', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;

      expect(usernameInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(roleSelect.value).toBe('1'); // default role — first in DEFAULT_ROLES (admin id=1)
    });

    it('should render cancel and create buttons', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty username', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const createButton = screen.getByRole('button', { name: /^create$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      });
    });

    it('should show error for username less than 3 characters', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      await user.type(usernameInput, 'ab');
      await user.tab(); // trigger blur

      await waitFor(() => {
        expect(screen.getByText(/username must be 3-15 characters/i)).toBeInTheDocument();
      });
    });

    it('should show error for username with special characters', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      await user.type(usernameInput, 'user@123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/username must be alphanumeric/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty password', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const createButton = screen.getByRole('button', { name: /^create$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('should show error for password less than 12 characters', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'correct hor');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('At least 12 characters')).toHaveClass('text-red-700');
      });
      expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
    });

    it('should not show errors for valid input', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(usernameInput, 'validuser123');
      await user.type(passwordInput, 'correct horse battery');
      await user.tab();

      // Wait a bit for any validation errors
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.queryByText(/username must be/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/password must/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call onCreate with correct data when submitting as user', async () => {
      const user = userEvent.setup();
      mockOnCreate.mockResolvedValueOnce(undefined);

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      const createButton = screen.getByRole('button', { name: /^create$/i });

      await user.type(usernameInput, 'newuser123');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          username: 'newuser123',
          password: 'SecurePass123!',
          role_id: 1,
        });
      });
    });

    it('should call onCreate with admin role when selected', async () => {
      const user = userEvent.setup();
      mockOnCreate.mockResolvedValueOnce(undefined);

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      const roleSelect = screen.getByLabelText('Role');
      const createButton = screen.getByRole('button', { name: /^create$/i });

      await user.type(usernameInput, 'adminuser');
      await user.type(passwordInput, 'AdminPass123!');
      await user.selectOptions(roleSelect, 'admin');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          username: 'adminuser',
          password: 'AdminPass123!',
          role_id: 1,
        });
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveCreate: () => void;
      const createPromise = new Promise<void>(resolve => {
        resolveCreate = resolve;
      });
      mockOnCreate.mockReturnValueOnce(createPromise);

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      const createButton = screen.getByRole('button', { name: /^create$/i });

      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(createButton);

      // Button should be disabled during loading
      await waitFor(() => {
        expect(createButton).toBeDisabled();
      });

      resolveCreate!();
    });

    it('should call onClose after successful submission', async () => {
      const user = userEvent.setup();
      mockOnCreate.mockResolvedValueOnce(undefined);

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      const createButton = screen.getByRole('button', { name: /^create$/i });

      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should display error message on submission failure', async () => {
      const user = userEvent.setup();
      mockOnCreate.mockRejectedValueOnce(new Error('Username already exists'));

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      const createButton = screen.getByRole('button', { name: /^create$/i });

      await user.type(usernameInput, 'existinguser');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      });

      // Should NOT call onClose on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should submit a passphrase and display the server message when it is rejected', async () => {
      const user = userEvent.setup();
      mockOnCreate.mockRejectedValueOnce(new Error('This password is too common, choose another one'));

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'newuser');
      await user.type(screen.getByLabelText('Password'), 'Password123!');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(screen.getByText('This password is too common, choose another one')).toBeInTheDocument();
      });
      expect(mockOnCreate).toHaveBeenCalledWith({ username: 'newuser', password: 'Password123!', role_id: 1 });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not submit a password equal to the username', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'cinemalover42');
      await user.type(screen.getByLabelText('Password'), 'CinemaLover42');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(screen.getByText(/different from the username/i)).toHaveClass('text-red-700');
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should display the error when the password equals the username', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'cinemalover42');
      await user.type(screen.getByLabelText('Password'), 'CinemaLover42');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(screen.getByText('Password must not be the same as the username')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveClass('border-red-500');
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should clear the password error once the password is corrected', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'cinemalover42');
      await user.type(screen.getByLabelText('Password'), 'cinemalover42');
      await user.tab();

      expect(screen.getByText('Password must not be the same as the username')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Password'), ' at the movies');

      expect(screen.queryByText('Password must not be the same as the username')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Password')).not.toHaveClass('border-red-500');
    });

    it('should clear the password error once the username no longer matches it', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'cinemalover42');
      await user.type(screen.getByLabelText('Password'), 'cinemalover42');
      await user.tab();

      expect(screen.getByText('Password must not be the same as the username')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Username'), 'x');
      await user.tab();

      expect(screen.queryByText('Password must not be the same as the username')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Password')).not.toHaveClass('border-red-500');
    });

    it('should keep showing a password error while the password is still invalid', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'cinemalover42');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.tab();

      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();

      await user.click(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Password'), 'er');

      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveClass('border-red-500');
    });

    it('should display the error when the password is longer than 128 characters', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      await user.type(screen.getByLabelText('Username'), 'newuser');
      await user.click(screen.getByLabelText('Password'));
      await user.paste('a'.repeat(129));
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(screen.getByText('Password must be at most 128 characters')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveClass('border-red-500');
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should not submit form with validation errors', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const usernameInput = screen.getByLabelText('Username');
      const passwordInput = screen.getByLabelText('Password');
      const createButton = screen.getByRole('button', { name: /^create$/i });

      await user.type(usernameInput, 'ab'); // too short
      await user.type(passwordInput, 'weak'); // weak password
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/username must be 3-15 characters/i)).toBeInTheDocument();
      });

      expect(mockOnCreate).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Action', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when clicking show/hide button', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      );

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      expect(passwordInput.type).toBe('text');

      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });
});
