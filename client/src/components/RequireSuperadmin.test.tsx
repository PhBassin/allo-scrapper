import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RequireSuperadmin } from './RequireSuperadmin';
import type { AuthContextType } from '../contexts/AuthContext';

// Hoisted mock values so vi.mock factory can reference them
const mockValues = vi.hoisted(() => ({
  isAuthenticated: false,
  isAdmin: false,
  token: null as string | null,
  user: null as AuthContextType['user'],
  hasPermission: () => false,
  login: () => {},
  logout: () => {},
}));

vi.mock('../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/AuthContext')>();
  const react = await import('react');
  const MockedAuthContext = react.createContext<AuthContextType>(mockValues as AuthContextType);
  return {
    ...actual,
    AuthContext: MockedAuthContext,
  };
});

function TestApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/superadmin"
          element={
            <RequireSuperadmin>
              <div>Superadmin Content</div>
            </RequireSuperadmin>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </BrowserRouter>
  );
}

describe('RequireSuperadmin', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/superadmin');
    mockValues.isAuthenticated = false;
    mockValues.isAdmin = false;
  });

  it('should redirect to /login when not authenticated', () => {
    render(<TestApp />);
    expect(screen.queryByText('Superadmin Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('should redirect when user is authenticated but not admin', () => {
    mockValues.isAuthenticated = true;
    mockValues.isAdmin = false;
    render(<TestApp />);
    expect(screen.queryByText('Superadmin Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('should redirect when user is admin but not authenticated', () => {
    mockValues.isAuthenticated = false;
    mockValues.isAdmin = true;
    render(<TestApp />);
    expect(screen.queryByText('Superadmin Content')).not.toBeInTheDocument();
  });

  it('should render children when user is authenticated and is a system admin', () => {
    mockValues.isAuthenticated = true;
    mockValues.isAdmin = true;
    render(<TestApp />);
    expect(screen.getByText('Superadmin Content')).toBeInTheDocument();
  });
});
