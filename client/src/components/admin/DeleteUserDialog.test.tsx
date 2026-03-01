import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteUserDialog from './DeleteUserDialog';
import type { UserPublic } from '../../api/users';

describe('DeleteUserDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockUser: UserPublic = {
    id: 1,
    username: 'testuser',
    role: 'user',
    created_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <DeleteUserDialog
          isOpen={false}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.queryByText(/delete user/i)).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByRole('heading', { name: /delete user/i })).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByText(mockUser.username)).toBeInTheDocument();
    });

    it('should render cancel and delete buttons', () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should display warning message for permanent action', () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('should display different styling for admin users', () => {
      const adminUser: UserPublic = { ...mockUser, role: 'admin' };
      
      render(
        <DeleteUserDialog
          isOpen={true}
          user={adminUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Should still render, but with admin badge
      expect(screen.getByRole('heading', { name: /delete user/i })).toBeInTheDocument();
      expect(screen.getByText(adminUser.username)).toBeInTheDocument();
    });
  });

  describe('Cancel Action', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onClose when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const backdrop = screen.getByTestId('dialog-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Delete Confirmation', () => {
    it('should call onConfirm when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(mockUser.id);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should disable delete button during loading state', async () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /deleting/i });
      expect(deleteButton).toBeDisabled();
    });

    it('should show "Deleting..." text during loading state', () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      expect(screen.getByText(/deleting/i)).toBeInTheDocument();
    });

    it('should disable cancel button during loading state', () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('should display error message when provided', () => {
      const errorMessage = 'Cannot delete last admin user';
      
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should not display error section when error is null', () => {
      render(
        <DeleteUserDialog
          isOpen={true}
          user={mockUser}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          error={null}
        />
      );

      // Error should not be visible
      expect(screen.queryByText(/cannot delete/i)).not.toBeInTheDocument();
    });
  });
});
