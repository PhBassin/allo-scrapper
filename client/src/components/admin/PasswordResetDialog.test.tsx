import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordResetDialog from './PasswordResetDialog';

describe('PasswordResetDialog', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <PasswordResetDialog
          isOpen={false}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/password reset successful/i)).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('heading', { name: /password reset successful/i })).toBeInTheDocument();
      expect(screen.getByText(/testuser/)).toBeInTheDocument();
    });

    it('should display the new password', () => {
      const password = 'NewPass123!';
      
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword={password}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByDisplayValue(password)).toBeInTheDocument();
    });

    it('should display copy button', () => {
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /copy password/i })).toBeInTheDocument();
    });

    it('should display close button', () => {
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('should display warning about one-time display', () => {
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/save this password now/i)).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('should copy password to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      const password = 'NewPass123!';
      
      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });

      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword={password}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy password/i });
      await user.click(copyButton);

      expect(writeTextMock).toHaveBeenCalledWith(password);
    });

    it('should show "Copied!" feedback after copying', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });

      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy password/i });
      await user.click(copyButton);

      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });

    it('should revert to "Copy Password" text after 2 seconds', async () => {
      vi.useFakeTimers();
      
      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });

      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy password/i });
      
      // Use act to handle async state updates
      await act(async () => {
        fireEvent.click(copyButton);
        // Wait for clipboard promise to resolve
        await Promise.resolve();
      });

      // Should show "Copied!"
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();

      // Fast-forward 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should revert to "Copy Password"
      expect(screen.getByRole('button', { name: /copy password/i })).toBeInTheDocument();
      expect(screen.queryByText(/copied!/i)).not.toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Close Action', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking backdrop (force user to read)', () => {
      render(
        <PasswordResetDialog
          isOpen={true}
          username="testuser"
          newPassword="NewPass123!"
          onClose={mockOnClose}
        />
      );

      const backdrop = screen.getByTestId('dialog-backdrop');
      fireEvent.click(backdrop);

      // Should NOT call onClose (force user to use Close button)
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
