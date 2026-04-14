import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RequireSuperadmin } from './RequireSuperadmin';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('RequireSuperadmin', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('should redirect to /login when no token', () => {
    const TestApp = () => (
      <BrowserRouter>
        <Routes>
          <Route path="/superadmin" element={
            <RequireSuperadmin>
              <div>Superadmin Content</div>
            </RequireSuperadmin>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    render(<TestApp />);
    expect(screen.queryByText('Superadmin Content')).not.toBeInTheDocument();
  });

  it('should redirect when token has no scope', () => {
    // Token without scope claim
    const payload = { id: 'user-1', username: 'user' };
    const base64Payload = btoa(JSON.stringify(payload));
    const fakeToken = `header.${base64Payload}.signature`;
    mockLocalStorage.setItem('token', fakeToken);

    const TestApp = () => (
      <BrowserRouter>
        <Routes>
          <Route path="/superadmin" element={
            <RequireSuperadmin>
              <div>Superadmin Content</div>
            </RequireSuperadmin>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    render(<TestApp />);
    expect(screen.queryByText('Superadmin Content')).not.toBeInTheDocument();
  });

  it('should redirect when scope is not superadmin', () => {
    const payload = { id: 'user-1', username: 'user', scope: 'org' };
    const base64Payload = btoa(JSON.stringify(payload));
    const fakeToken = `header.${base64Payload}.signature`;
    mockLocalStorage.setItem('token', fakeToken);

    const TestApp = () => (
      <BrowserRouter>
        <Routes>
          <Route path="/superadmin" element={
            <RequireSuperadmin>
              <div>Superadmin Content</div>
            </RequireSuperadmin>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    render(<TestApp />);
    expect(screen.queryByText('Superadmin Content')).not.toBeInTheDocument();
  });

  it('should render children when scope is superadmin', () => {
    const payload = { id: 'super-1', username: 'superadmin', scope: 'superadmin' };
    const base64Payload = btoa(JSON.stringify(payload));
    const fakeToken = `header.${base64Payload}.signature`;
    mockLocalStorage.setItem('token', fakeToken);

    const TestApp = () => (
      <BrowserRouter>
        <Routes>
          <Route path="/superadmin" element={
            <RequireSuperadmin>
              <div>Superadmin Content</div>
            </RequireSuperadmin>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    window.history.pushState({}, '', '/superadmin');
    render(<TestApp />);
    expect(screen.getByText('Superadmin Content')).toBeInTheDocument();
  });
});
