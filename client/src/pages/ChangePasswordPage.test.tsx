/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChangePasswordPage from './ChangePasswordPage';
import apiClient from '../api/client';
import { AuthContext, type User } from '../contexts/AuthContext';

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

function renderChangePasswordPage(user: User | null = null) {
  render(
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        user,
        isAdmin: false,
        hasPermission: () => false,
        login: () => {},
        logout: () => {},
      }}
    >
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

const CINEMA_LOVER: User = {
  id: 7,
  username: 'cinemalover42',
  role_id: 2,
  role_name: 'operator',
  is_system_role: false,
  permissions: [],
};

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
  fireEvent.change(newPasswordInput, { target: { value: overrides?.newPassword ?? 'correct horse battery' } });
  fireEvent.change(confirmPasswordInput, { target: { value: overrides?.confirmPassword ?? 'correct horse battery' } });
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

    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at most 128 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/uppercase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/special character/i)).not.toBeInTheDocument();
  });

  it('should show dynamic validation icons that update as user types', async () => {
    renderChangePasswordPage();

    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const lengthItem = screen.getByText(/at least 12 characters/i).closest('li');

    // Initially the minimum length is not met
    expect(lengthItem?.querySelector('.text-red-500')).toBeInTheDocument();

    // 11 characters: still red
    fireEvent.change(newPasswordInput, { target: { value: 'correct hor' } });
    expect(lengthItem?.querySelector('.text-red-500')).toBeInTheDocument();

    // 12 characters of lowercase letters and spaces: green
    fireEvent.change(newPasswordInput, { target: { value: 'correct hors' } });
    await waitFor(() => {
      expect(lengthItem?.querySelector('.text-green-500')).toBeInTheDocument();
    });
  });

  it('should flag a new password equal to the signed-in username', async () => {
    renderChangePasswordPage(CINEMA_LOVER);

    const usernameItem = screen.getByText(/different from the username/i).closest('li');
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'CinemaLover42' } });
    await waitFor(() => {
      expect(usernameItem?.querySelector('.text-red-500')).toBeInTheDocument();
    });

    fillFormAndSubmit({ newPassword: 'CinemaLover42', confirmPassword: 'CinemaLover42' });

    await waitFor(() => {
      expect(screen.getByText('Password must not be the same as the username')).toBeInTheDocument();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('should show error if passwords do not match', async () => {
    renderChangePasswordPage();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput, submitButton } = getFormElements();

    fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123!' } });
    fireEvent.change(newPasswordInput, { target: { value: 'correct horse battery' } });
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
      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
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
         newPassword: 'correct horse battery',
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

  it('should submit a blocklisted password and show the server message', async () => {
    const error: any = new Error('API Error');
    error.status = 400;
    error.data = { success: false, error: 'This password is too common, choose another one' };
    (apiClient.post as any).mockRejectedValue(error);

    renderChangePasswordPage();

    fillFormAndSubmit({ newPassword: 'Password123!', confirmPassword: 'Password123!' });

    await waitFor(() => {
      expect(screen.getByText('This password is too common, choose another one')).toBeInTheDocument();
    });
    expect(apiClient.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'OldPass123!',
      newPassword: 'Password123!',
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
