import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateUserModal from './CreateUserModal';

describe('CreateUserModal - Visual Password Validation', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display the password constraints list', () => {
    render(
      <CreateUserModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText(/constraints:/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one digit/i)).toBeInTheDocument();
    expect(screen.getByText(/one special character/i)).toBeInTheDocument();
  });

  it('should show red indicators when password is empty', () => {
    render(
      <CreateUserModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const labels = [
      /at least 8 characters/i,
      /one uppercase letter/i,
      /one lowercase letter/i,
      /one digit/i,
      /one special character/i
    ];

    labels.forEach(label => {
      const element = screen.getByText(label);
      expect(element).toHaveClass('text-red-700');
    });
  });

  it('should update indicators when constraints are met', async () => {
    const user = userEvent.setup();
    render(
      <CreateUserModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const passwordInput = screen.getByLabelText('Password');

    // Test length
    await user.type(passwordInput, '12345678');
    expect(screen.getByText(/at least 8 characters/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/one uppercase letter/i)).toHaveClass('text-red-700');

    // Test uppercase
    await user.clear(passwordInput);
    await user.type(passwordInput, 'A');
    expect(screen.getByText(/one uppercase letter/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/at least 8 characters/i)).toHaveClass('text-red-700');

    // Test lowercase
    await user.clear(passwordInput);
    await user.type(passwordInput, 'a');
    expect(screen.getByText(/one lowercase letter/i)).toHaveClass('text-green-700');

    // Test digit
    await user.clear(passwordInput);
    await user.type(passwordInput, '1');
    expect(screen.getByText(/one digit/i)).toHaveClass('text-green-700');

    // Test special character
    await user.clear(passwordInput);
    await user.type(passwordInput, '!');
    expect(screen.getByText(/one special character/i)).toHaveClass('text-green-700');

    // Test all met
    await user.clear(passwordInput);
    await user.type(passwordInput, 'ValidPass123!');
    expect(screen.getByText(/at least 8 characters/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/one uppercase letter/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/one lowercase letter/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/one digit/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/one special character/i)).toHaveClass('text-green-700');
  });
});
