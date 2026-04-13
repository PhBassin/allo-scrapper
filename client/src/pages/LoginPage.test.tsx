import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthContext, type User } from '../contexts/AuthContext';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock useNavigate to capture navigation calls
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a session expired message when redirected with session_expired reason', () => {
    renderLoginWithState({ reason: 'session_expired', from: { pathname: '/admin' } });

    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument();
  });

  it('does not show session expired message on normal login page access', () => {
    renderLoginWithState();

    expect(screen.queryByText('Your session expired. Please sign in again.')).not.toBeInTheDocument();
  });

  describe('Post-login redirect behavior', () => {
    it('redirects system admin to /superadmin when no from location provided', async () => {
      const systemAdmin: User = {
        id: 1,
        username: 'admin',
        role_id: 1,
        role_name: 'admin',
        is_system_role: true,
        permissions: [],
      };

      const mockLogin = vi.fn();
      const authValueWithMock = { ...authValue, login: mockLogin };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: { token: 'test-token', user: systemAdmin },
        },
      });

      render(
        <AuthContext.Provider value={authValueWithMock}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), 'admin');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', systemAdmin);
        expect(mockNavigate).toHaveBeenCalledWith('/superadmin', { replace: true });
      });
    });

    it('redirects system admin to /superadmin even when from location is provided', async () => {
      const systemAdmin: User = {
        id: 1,
        username: 'admin',
        role_id: 1,
        role_name: 'admin',
        is_system_role: true,
        permissions: [],
      };

      const mockLogin = vi.fn();
      const authValueWithMock = { ...authValue, login: mockLogin };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: { token: 'test-token', user: systemAdmin },
        },
      });

      render(
        <AuthContext.Provider value={authValueWithMock}>
          <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/org/acme/admin' } } }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), 'admin');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', systemAdmin);
        expect(mockNavigate).toHaveBeenCalledWith('/superadmin', { replace: true });
      });
    });

    it('redirects org user to /org/{slug} when no from location provided', async () => {
      const orgUser: User = {
        id: 2,
        username: 'orgadmin',
        role_id: 2,
        role_name: 'org_admin',
        is_system_role: false,
        permissions: [],
        org_slug: 'acme',
      };

      const mockLogin = vi.fn();
      const authValueWithMock = { ...authValue, login: mockLogin };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: { token: 'test-token', user: orgUser },
        },
      });

      render(
        <AuthContext.Provider value={authValueWithMock}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), 'orgadmin');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', orgUser);
        expect(mockNavigate).toHaveBeenCalledWith('/org/acme', { replace: true });
      });
    });

    it('redirects org user to requested path within their org', async () => {
      const orgUser: User = {
        id: 2,
        username: 'orgadmin',
        role_id: 2,
        role_name: 'org_admin',
        is_system_role: false,
        permissions: [],
        org_slug: 'acme',
      };

      const mockLogin = vi.fn();
      const authValueWithMock = { ...authValue, login: mockLogin };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: { token: 'test-token', user: orgUser },
        },
      });

      render(
        <AuthContext.Provider value={authValueWithMock}>
          <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/org/acme/cinema/123' } } }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), 'orgadmin');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', orgUser);
        expect(mockNavigate).toHaveBeenCalledWith('/org/acme/cinema/123', { replace: true });
      });
    });

    it('redirects regular user to landing page when no from location provided', async () => {
      const regularUser: User = {
        id: 3,
        username: 'user',
        role_id: 3,
        role_name: 'viewer',
        is_system_role: false,
        permissions: [],
      };

      const mockLogin = vi.fn();
      const authValueWithMock = { ...authValue, login: mockLogin };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: { token: 'test-token', user: regularUser },
        },
      });

      render(
        <AuthContext.Provider value={authValueWithMock}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), 'user');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', regularUser);
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });

    it('redirects regular user to requested path when from location provided', async () => {
      const regularUser: User = {
        id: 3,
        username: 'user',
        role_id: 3,
        role_name: 'viewer',
        is_system_role: false,
        permissions: [],
      };

      const mockLogin = vi.fn();
      const authValueWithMock = { ...authValue, login: mockLogin };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: { token: 'test-token', user: regularUser },
        },
      });

      render(
        <AuthContext.Provider value={authValueWithMock}>
          <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/some/path' } } }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), 'user');
      await user.type(screen.getByLabelText(/password/i), 'password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test-token', regularUser);
        expect(mockNavigate).toHaveBeenCalledWith('/some/path', { replace: true });
      });
    });
  });
});
