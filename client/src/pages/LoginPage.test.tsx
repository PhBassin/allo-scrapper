import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthContext, type User } from '../contexts/AuthContext';

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  username: 'test',
  role_id: 1,
  role_name: 'admin',
  is_system_role: true,
  permissions: [],
} as User;

const authValue = {
  isAuthenticated: false,
  token: null,
  user: mockUser,
  isAdmin: false,
  hasPermission: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
};

function renderLoginWithState(state?: { reason?: 'session_expired'; from?: { pathname?: string } }) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  it('shows a session expired message when redirected with session_expired reason', () => {
    renderLoginWithState({ reason: 'session_expired', from: { pathname: '/admin' } });

    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument();
  });

  it('does not show session expired message on normal login page access', () => {
    renderLoginWithState();

    expect(screen.queryByText('Your session expired. Please sign in again.')).not.toBeInTheDocument();
  });
});
