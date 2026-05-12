import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { AuthContext, type User } from './AuthContext';
import { AuthProvider } from './AuthProvider';

function createTokenWithExp(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const payload = btoa(JSON.stringify({ exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${header}.${payload}.signature`;
}

function createValidToken(): string {
  return createTokenWithExp(Math.floor(Date.now() / 1000) + 3600);
}

const adminUser: User = {
  id: 1,
  username: 'admin',
  role_id: 1,
  role_name: 'admin',
  is_system_role: true,
  permissions: ['users:list', 'users:create', 'scraper:trigger'],
};

const operatorUser: User = {
  id: 2,
  username: 'operator',
  role_id: 2,
  role_name: 'operator',
  is_system_role: true,
  permissions: ['scraper:trigger', 'theaters:create'],
};

// Helper component to expose context values
function ContextConsumer() {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <span data-testid="isAuthenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="isAdmin">{String(ctx.isAdmin)}</span>
      <span data-testid="username">{ctx.user?.username ?? ''}</span>
      <span data-testid="role_name">{ctx.user?.role_name ?? ''}</span>
      <span data-testid="perm-scraper">{String(ctx.hasPermission('scraper:trigger'))}</span>
      <span data-testid="perm-users-delete">{String(ctx.hasPermission('users:delete'))}</span>
    </div>
  );
}

// Render AuthProvider and wait for the async /api/auth/me fetch to complete
async function renderProvider(ui: React.ReactNode) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AuthProvider>{ui}</AuthProvider>);
  });
  return result!;
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // AuthProvider fetches /api/auth/me on mount. Default: unauthenticated (ok: false).
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should be unauthenticated by default', async () => {
      await renderProvider(<ContextConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
      expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    });

    it('should restore session when /api/auth/me returns a valid user', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: operatorUser }),
      });

      await renderProvider(<ContextConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('username').textContent).toBe('operator');
    });

    it('should treat malformed /api/auth/me response as unauthenticated', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      });

      await renderProvider(<ContextConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    });

    it('should stay unauthenticated when /api/auth/me throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

      await renderProvider(<ContextConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    });
  });

  describe('User interface', () => {
    it('should expose role_id and role_name on the User type', async () => {
      function LoginButton() {
        const { login } = useContext(AuthContext);
        return (
          <button onClick={() => login(createValidToken(), operatorUser)}>Login</button>
        );
      }

      await act(async () => {
        render(
          <AuthProvider>
            <ContextConsumer />
            <LoginButton />
          </AuthProvider>
        );
      });

      await act(async () => {
        screen.getByRole('button', { name: 'Login' }).click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('username').textContent).toBe('operator');
      expect(screen.getByTestId('role_name').textContent).toBe('operator');
    });
  });

  describe('isAdmin', () => {
    async function renderWithLogin(user: User) {
      function LoginButton() {
        const { login } = useContext(AuthContext);
        return (
          <button onClick={() => login(createValidToken(), user)}>Login</button>
        );
      }
      await act(async () => {
        render(
          <AuthProvider>
            <ContextConsumer />
            <LoginButton />
          </AuthProvider>
        );
      });
      await act(async () => {
        screen.getByRole('button', { name: 'Login' }).click();
      });
    }

    it('should be true when role_name is admin AND is_system_role is true', async () => {
      await renderWithLogin(adminUser);
      expect(screen.getByTestId('isAdmin').textContent).toBe('true');
    });

    it('should be false when role_name is not admin', async () => {
      await renderWithLogin(operatorUser);
      expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    });

    it('should be false when role_name is admin but is_system_role is false', async () => {
      const fakeAdmin: User = {
        id: 99,
        username: 'fakeadmin',
        role_id: 99,
        role_name: 'admin',
        is_system_role: false,
        permissions: ['theaters:create'],
      };
      await renderWithLogin(fakeAdmin);
      expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    });
  });

  describe('hasPermission', () => {
    async function renderWithLogin(user: User) {
      function LoginButton() {
        const { login } = useContext(AuthContext);
        return (
          <button onClick={() => login(createValidToken(), user)}>Login</button>
        );
      }
      await act(async () => {
        render(
          <AuthProvider>
            <ContextConsumer />
            <LoginButton />
          </AuthProvider>
        );
      });
      await act(async () => {
        screen.getByRole('button', { name: 'Login' }).click();
      });
    }

    it('should return true for admin regardless of permission string', async () => {
      await renderWithLogin(adminUser);
      expect(screen.getByTestId('perm-scraper').textContent).toBe('true');
      expect(screen.getByTestId('perm-users-delete').textContent).toBe('true');
    });

    it('should return true when permission is in user permissions list', async () => {
      await renderWithLogin(operatorUser);
      expect(screen.getByTestId('perm-scraper').textContent).toBe('true');
    });

    it('should return false when permission is not in user permissions list', async () => {
      await renderWithLogin(operatorUser);
      expect(screen.getByTestId('perm-users-delete').textContent).toBe('false');
    });

    it('should return false when user is not authenticated', async () => {
      await renderProvider(<ContextConsumer />);
      expect(screen.getByTestId('perm-scraper').textContent).toBe('false');
    });
  });

  describe('login / logout', () => {
    function LoginLogout() {
      const ctx = useContext(AuthContext);
      return (
        <div>
          <span data-testid="auth">{String(ctx.isAuthenticated)}</span>
          <button onClick={() => ctx.login(createValidToken(), adminUser)}>Login</button>
          <button onClick={() => ctx.logout()}>Logout</button>
        </div>
      );
    }

    it('should authenticate after login', async () => {
      await act(async () => {
        render(
          <AuthProvider>
            <LoginLogout />
          </AuthProvider>
        );
      });

      expect(screen.getByTestId('auth').textContent).toBe('false');

      await act(async () => {
        screen.getByRole('button', { name: 'Login' }).click();
      });

      expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    it('should clear auth after logout', async () => {
      // Mock /api/auth/me returning adminUser so we start authenticated
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: adminUser }),
        })
        .mockResolvedValue({ ok: false }); // logout call

      await act(async () => {
        render(
          <AuthProvider>
            <LoginLogout />
          </AuthProvider>
        );
      });

      expect(screen.getByTestId('auth').textContent).toBe('true');

      await act(async () => {
        screen.getByRole('button', { name: 'Logout' }).click();
      });

      expect(screen.getByTestId('auth').textContent).toBe('false');
    });
  });

  describe('Proactive token expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-logout when token expires without page refresh', async () => {
      const expireInTwoSeconds = Math.floor(Date.now() / 1000) + 2;
      const shortLivedToken = createTokenWithExp(expireInTwoSeconds);

      const mockEventListener = vi.fn();
      window.addEventListener('auth:unauthorized', mockEventListener);

      function LoginButton() {
        const { login } = useContext(AuthContext);
        return (
          <button onClick={() => login(shortLivedToken, adminUser)}>Login</button>
        );
      }

      await act(async () => {
        render(
          <AuthProvider>
            <ContextConsumer />
            <LoginButton />
          </AuthProvider>
        );
      });

      await act(async () => {
        screen.getByRole('button', { name: 'Login' }).click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('username').textContent).toBe('admin');

      // Fast forward past expiry time
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
      expect(screen.getByTestId('username').textContent).toBe('');
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            reason: 'session_expired',
          }),
        })
      );

      window.removeEventListener('auth:unauthorized', mockEventListener);
    });

    it('should reschedule timer on login', async () => {
      function LoginButton() {
        const { login } = useContext(AuthContext);
        return (
          <button onClick={() => {
            const expireInTwoSeconds = Math.floor(Date.now() / 1000) + 2;
            login(createTokenWithExp(expireInTwoSeconds), adminUser);
          }}>
            Login
          </button>
        );
      }

      await act(async () => {
        render(
          <AuthProvider>
            <ContextConsumer />
            <LoginButton />
          </AuthProvider>
        );
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');

      act(() => {
        screen.getByRole('button', { name: 'Login' }).click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');

      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    });

    it('should clear timer on manual logout', async () => {
      const expireInTenSeconds = Math.floor(Date.now() / 1000) + 10;
      const token = createTokenWithExp(expireInTenSeconds);

      const mockEventListener = vi.fn();
      window.addEventListener('auth:unauthorized', mockEventListener);

      function LoginLogout() {
        const { login, logout } = useContext(AuthContext);
        return (
          <div>
            <button onClick={() => login(token, adminUser)}>Login</button>
            <button onClick={logout}>Logout</button>
          </div>
        );
      }

      await act(async () => {
        render(
          <AuthProvider>
            <ContextConsumer />
            <LoginLogout />
          </AuthProvider>
        );
      });

      act(() => {
        screen.getByRole('button', { name: 'Login' }).click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');

      await act(async () => {
        screen.getByRole('button', { name: 'Logout' }).click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');

      act(() => {
        vi.advanceTimersByTime(10100);
      });

      // Event should NOT fire because timer was cleared
      expect(mockEventListener).not.toHaveBeenCalled();

      window.removeEventListener('auth:unauthorized', mockEventListener);
    });
  });
});
