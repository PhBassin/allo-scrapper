/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChangePasswordPage from './ChangePasswordPage';
import apiClient from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderChangePasswordPage() {
  render(
    <MemoryRouter>
      <ChangePasswordPage />
    </MemoryRouter>
  );
}

function getFormElements() {
  return {
    currentPasswordInput: screen.getByLabelText(/current password/i),
    newPasswordInput: screen.getByLabelText(/^new password$/i),
    confirmPasswordInput: screen.getByLabelText(/confirm new password/i),
    submitButton: screen.getByRole('button', { name: /change password/i }),
  };
}

function fillFormAndSubmit(overrides?: { currentPassword?: string; newPassword?: string; confirmPassword?: string }) {
  const { currentPasswordInput, newPasswordInput, confirmPasswordInput, submitButton } = getFormElements();
  fireEvent.change(currentPasswordInput, { target: { value: overrides?.currentPassword ?? 'OldPass123!' } });
  fireEvent.change(newPasswordInput, { target: { value: overrides?.newPassword ?? 'NewPass123!' } });
  fireEvent.change(confirmPasswordInput, { target: { value: overrides?.confirmPassword ?? 'NewPass123!' } });
  fireEvent.click(submitButton);
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should render all form fields', () => {
    renderChangePasswordPage();

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should show password strength requirements hint', () => {
    renderChangePasswordPage();

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one digit/i)).toBeInTheDocument();
    expect(screen.getByText(/one special character/i)).toBeInTheDocument();
  });

  it('should show dynamic validation icons that update as user types', async () => {
    renderChangePasswordPage();

    const newPasswordInput = screen.getByLabelText(/^new password$/i);

    // Initially all should show red icons
    const uppercaseItem = screen.getByText(/one uppercase letter/i).closest('li');
    expect(uppercaseItem?.querySelector('.text-red-500')).toBeInTheDocument();

    // Type uppercase letter - should turn green
    fireEvent.change(newPasswordInput, { target: { value: 'A' } });
    await waitFor(() => {
      expect(uppercaseItem?.querySelector('.text-green-500')).toBeInTheDocument();
    });

    // Type more - lowercase
    fireEvent.change(newPasswordInput, { target: { value: 'Aa' } });
    const lowercaseItem = screen.getByText(/one lowercase letter/i).closest('li');
    await waitFor(() => {
      expect(lowercaseItem?.querySelector('.text-green-500')).toBeInTheDocument();
    });

    // Type digit
    fireEvent.change(newPasswordInput, { target: { value: 'Aa1' } });
    const digitItem = screen.getByText(/one digit/i).closest('li');
    await waitFor(() => {
      expect(digitItem?.querySelector('.text-green-500')).toBeInTheDocument();
    });

    // Type special char
    fireEvent.change(newPasswordInput, { target: { value: 'Aa1!' } });
    const specialItem = screen.getByText(/one special character/i).closest('li');
    await waitFor(() => {
      expect(specialItem?.querySelector('.text-green-500')).toBeInTheDocument();
    });

    // Type more to reach 8 chars
    fireEvent.change(newPasswordInput, { target: { value: 'Aa1!bbbb' } });
    const lengthItem = screen.getByText(/at least 8 characters/i).closest('li');
    await waitFor(() => {
      expect(lengthItem?.querySelector('.text-green-500')).toBeInTheDocument();
    });
  });

  it('should show error if passwords do not match', async () => {
    renderChangePasswordPage();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput, submitButton } = getFormElements();

    fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123!' } });
    fireEvent.change(newPasswordInput, { target: { value: 'NewPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('should show error if password does not meet requirements', async () => {
    renderChangePasswordPage();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput, submitButton } = getFormElements();

    fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123!' } });
    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('should disable submit button during loading', async () => {
    (apiClient.post as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderChangePasswordPage();

    const { submitButton } = getFormElements();

    fillFormAndSubmit();

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should call API with correct payload on submit', async () => {
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { message: 'Password changed successfully' },
    });

    renderChangePasswordPage();

    fillFormAndSubmit();

     await waitFor(() => {
       expect(apiClient.post).toHaveBeenCalledWith('/auth/change-password', {
         currentPassword: 'OldPass123!',
         newPassword: 'NewPass123!',
       });
     }, { timeout: 5000 });
  });

  it('should navigate to homepage after 2 seconds on successful password change', async () => {
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { message: 'Password changed successfully' },
    });

    // Use fake timers to control setTimeout
    vi.useFakeTimers();
    
    renderChangePasswordPage();

    fillFormAndSubmit();

    await vi.waitFor(() => {
      expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument();
    }, { timeout: 1000 });

    // Advance timers by 2 seconds to trigger setTimeout
    await vi.advanceTimersByTimeAsync(2000);
    
    // Expect navigation to have been called
    expect(mockNavigate).toHaveBeenCalledWith('/');
    
    // Clean up
    vi.useRealTimers();
  });

  it('should show success message on successful password change', async () => {
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { message: 'Password changed successfully' },
    });

    renderChangePasswordPage();

    fillFormAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument();
    });
  });

  it('should clear form on success', async () => {
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { message: 'Password changed successfully' },
    });

    renderChangePasswordPage();

    const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement;
    const newPasswordInput = screen.getByLabelText(/^new password$/i) as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement;

    fillFormAndSubmit();

    await waitFor(() => {
      expect(currentPasswordInput.value).toBe('');
      expect(newPasswordInput.value).toBe('');
      expect(confirmPasswordInput.value).toBe('');
    });
  });

  it('should show error message on API failure', async () => {
    const error: any = new Error('API Error');
    error.data = { error: 'Current password is incorrect' };
    (apiClient.post as any).mockRejectedValue(error);

    renderChangePasswordPage();

    fillFormAndSubmit({ currentPassword: 'WrongPass123!' });

    await waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors gracefully', async () => {
    (apiClient.post as any).mockRejectedValue(new Error('Network error'));

    renderChangePasswordPage();

    fillFormAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it('should navigate to home on cancel', () => {
    renderChangePasswordPage();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
