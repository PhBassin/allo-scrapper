import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequireSuperadmin from './RequireSuperadmin';
import { AuthContext, type AuthContextType } from '../contexts/AuthContext';
import { ConfigContext } from '../contexts/ConfigContext';

// Helper to build a minimal AuthContextType
function makeAuthCtx(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    isAuthenticated: false,
    token: null,
    user: null,
    isAdmin: false,
    isSuperadmin: false,
    hasPermission: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

function renderWith(authCtx: AuthContextType, saasEnabled: boolean, path = '/superadmin') {
  return render(
    <ConfigContext.Provider value={{ config: { saasEnabled }, isLoading: false }}>
      <AuthContext.Provider value={authCtx}>
        <MemoryRouter initialEntries={[path]}>
          <RequireSuperadmin>
            <div data-testid="protected-content">Superadmin Content</div>
          </RequireSuperadmin>
        </MemoryRouter>
      </AuthContext.Provider>
    </ConfigContext.Provider>,
  );
}

describe('RequireSuperadmin', () => {
  it('renders children when isSuperadmin=true and saasEnabled=true', () => {
    renderWith(makeAuthCtx({ isAuthenticated: true, isSuperadmin: true }), true);
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderWith(makeAuthCtx({ isAuthenticated: false, isSuperadmin: false }), true);
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to / when authenticated but not superadmin', () => {
    renderWith(makeAuthCtx({ isAuthenticated: true, isSuperadmin: false }), true);
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to / when saasEnabled=false even for superadmin', () => {
    renderWith(makeAuthCtx({ isAuthenticated: true, isSuperadmin: true }), false);
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
