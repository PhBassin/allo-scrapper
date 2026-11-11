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
    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at most 128 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/passphrases are welcome/i)).toBeInTheDocument();
    expect(screen.queryByText(/uppercase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/one digit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/special character/i)).not.toBeInTheDocument();
  });

  it('should show no requirement as met while the password is empty', () => {
    render(
      <CreateUserModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText(/at least 12 characters/i)).toHaveClass('text-red-700');
    expect(screen.getByText(/at most 128 characters/i)).toHaveClass('text-red-700');
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

    // 11 characters: still too short
    await user.type(passwordInput, 'correct hor');
    expect(screen.getByText(/at least 12 characters/i)).toHaveClass('text-red-700');

    // 12 characters, no uppercase/digit/special: all met
    await user.type(passwordInput, 's');
    expect(screen.getByText(/at least 12 characters/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/at most 128 characters/i)).toHaveClass('text-green-700');

    // 129 characters: too long
    await user.clear(passwordInput);
    await user.click(passwordInput);
    await user.paste('a'.repeat(129));
    expect(screen.getByText(/at least 12 characters/i)).toHaveClass('text-green-700');
    expect(screen.getByText(/at most 128 characters/i)).toHaveClass('text-red-700');
  });
});
