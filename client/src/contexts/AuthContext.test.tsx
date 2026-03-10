import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { AuthContext, AuthProvider } from './AuthContext';
import type { User } from './AuthContext';

const adminUser: User = {
  id: 1,
  username: 'admin',
  role_id: 1,
  role_name: 'admin',
  permissions: ['users:list', 'users:create', 'scraper:trigger'],
};

const operatorUser: User = {
  id: 2,
  username: 'operator',
  role_id: 2,
  role_name: 'operator',
  permissions: ['scraper:trigger', 'cinemas:create'],
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

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should be unauthenticated by default', () => {
      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
      expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    });
  });

  describe('User interface', () => {
    it('should expose role_id and role_name on the User type', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify(operatorUser));

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('username').textContent).toBe('operator');
      expect(screen.getByTestId('role_name').textContent).toBe('operator');
    });
  });

  describe('isAdmin', () => {
    it('should be true when role_name is admin', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify(adminUser));

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('isAdmin').textContent).toBe('true');
    });

    it('should be false when role_name is not admin', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify(operatorUser));

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin regardless of permission string', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify(adminUser));

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      // scraper:trigger is in admin permissions list, but even users:delete is bypassed for admin
      expect(screen.getByTestId('perm-scraper').textContent).toBe('true');
      expect(screen.getByTestId('perm-users-delete').textContent).toBe('true');
    });

    it('should return true when permission is in user permissions list', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify(operatorUser));

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('perm-scraper').textContent).toBe('true');
    });

    it('should return false when permission is not in user permissions list', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify(operatorUser));

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('perm-users-delete').textContent).toBe('false');
    });

    it('should return false when user is not authenticated', () => {
      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      expect(screen.getByTestId('perm-scraper').textContent).toBe('false');
    });
  });

  describe('login / logout', () => {
    function LoginLogout() {
      const ctx = useContext(AuthContext);
      return (
        <div>
          <span data-testid="auth">{String(ctx.isAuthenticated)}</span>
          <button onClick={() => ctx.login('tok', adminUser)}>Login</button>
          <button onClick={() => ctx.logout()}>Logout</button>
        </div>
      );
    }

    it('should authenticate after login', async () => {
      render(
        <AuthProvider>
          <LoginLogout />
        </AuthProvider>
      );

      expect(screen.getByTestId('auth').textContent).toBe('false');

      await act(async () => {
        screen.getByRole('button', { name: 'Login' }).click();
      });

      expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    it('should clear auth after logout', async () => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('user', JSON.stringify(adminUser));

      render(
        <AuthProvider>
          <LoginLogout />
        </AuthProvider>
      );

      expect(screen.getByTestId('auth').textContent).toBe('true');

      await act(async () => {
        screen.getByRole('button', { name: 'Logout' }).click();
      });

      expect(screen.getByTestId('auth').textContent).toBe('false');
    });
  });
});
