import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';
import type { PermissionName } from '../types/role';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Layout tenant navigation scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/org/acme/admin',
      },
    });
  });

  const authValue = {
    isAuthenticated: true,
    token: 'token',
    user: {
      id: 1,
      username: 'tenant-admin',
      role_id: 1,
      role_name: 'admin',
      is_system_role: false,
      permissions: ['settings:update', 'cinemas:read'] as PermissionName[],
    },
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: true,
    hasPermission: vi.fn((permission: PermissionName) => permission === 'cinemas:read'),
  };

  const settingsValue = {
    publicSettings: {
      site_name: 'Acme Cinema',
      logo_base64: null,
      favicon_base64: null,
      color_primary: '#FECC00',
      color_secondary: '#1F2937',
      color_accent: '#3B82F6',
      color_background: '#FFFFFF',
      color_surface: '#E5E7EB',
      color_text_primary: '#1F2937',
      color_text_secondary: '#6B7280',
      color_success: '#10B981',
      color_error: '#EF4444',
      font_primary: 'Inter',
      font_secondary: 'Inter',
      footer_text: 'Footer',
      footer_links: [],
    },
    adminSettings: null,
    isLoading: false,
    isLoadingPublic: false,
    error: null,
    refreshPublicSettings: vi.fn(),
    refreshAdminSettings: vi.fn(),
    updateSettings: vi.fn(),
  };

  function renderLayout(isAuthenticated = true) {
    return render(
      <MemoryRouter>
        <AuthContext.Provider value={{ ...authValue, isAuthenticated }}>
          <SettingsContext.Provider value={settingsValue}>
            <Layout>
              <div>Child content</div>
            </Layout>
          </SettingsContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }

  it('scopes header navigation links to the tenant', () => {
    renderLayout();

    expect(screen.getByRole('link', { name: /acme cinema/i })).toHaveAttribute('href', '/org/acme/');
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/org/acme/');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/org/acme/admin?tab=cinemas');
  });

  it('scopes account links and logout redirect to the tenant', () => {
    renderLayout();

    fireEvent.click(screen.getByTestId('user-menu-button'));

    expect(screen.getByTestId('change-password-link')).toHaveAttribute('href', '/org/acme/change-password');

    fireEvent.click(screen.getByTestId('logout-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/org/acme/');
  });

  it('scopes the login link to the tenant for anonymous users', () => {
    renderLayout(false);

    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/org/acme/login');
  });
});
