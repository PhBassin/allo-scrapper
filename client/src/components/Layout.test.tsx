import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';

const mockAuthContext = {
  isAuthenticated: true,
  isAdmin: true,
  hasPermission: vi.fn(() => true),
  token: 'mock-token',
  user: { id: 1, username: 'admin', role_id: 1, role_name: 'admin', is_system_role: true, permissions: ['scraper:trigger', 'cinemas:create'] },
  login: vi.fn(),
  logout: vi.fn(),
};

const mockNonAdminAuthContext = {
  isAuthenticated: true,
  isAdmin: false,
  hasPermission: vi.fn(() => false),
  token: 'mock-token',
  user: { id: 2, username: 'user', role_id: 2, role_name: 'user', is_system_role: false, permissions: [] },
  login: vi.fn(),
  logout: vi.fn(),
};

const mockSettingsContext = {
      publicSettings: {
        site_name: 'Test Cinema App',
        logo_base64: null,
        favicon_base64: null,
        color_primary: '#1976d2',
        color_secondary: '#dc004e',
        color_accent: '#ff9800',
        color_background: '#ffffff',
        color_text: '#000000',
        color_text_secondary: '#666666',
        color_border: '#e0e0e0',
        color_success: '#4caf50',
        color_error: '#f44336',
        font_family_heading: 'Roboto',
        font_family_body: 'Roboto',
        footer_text: 'Test Footer',
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

const renderWithProviders = (authContext: typeof mockAuthContext | typeof mockNonAdminAuthContext = mockAuthContext) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authContext}>
        <SettingsContext.Provider value={mockSettingsContext}>
          <Layout>Test Content</Layout>
        </SettingsContext.Provider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Layout - Header navigation changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase 3: Admin link in header', () => {
    it('should display "Admin" link in header for authenticated admin users', () => {
      renderWithProviders(mockAuthContext);
      
      // Should have Admin link
      const adminLink = screen.getByRole('link', { name: /admin/i });
      expect(adminLink).toBeInTheDocument();
      expect(adminLink).toHaveAttribute('href', '/admin?tab=cinemas');
    });

    it('should NOT display "Admin" link for non-admin users', () => {
      renderWithProviders(mockNonAdminAuthContext);
      
      // Should NOT have Admin link
      expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
    });

    it('should NOT display "Rapports" link in header anymore', () => {
      renderWithProviders(mockAuthContext);
      
      // Old "Rapports" link should be gone from header
      const headerLinks = screen.getAllByRole('link').filter(link => 
        link.closest('nav') && !link.closest('[data-testid="user-dropdown-menu"]')
      );
      
      const rapportsLink = headerLinks.find(link => link.textContent === 'Rapports');
      expect(rapportsLink).toBeUndefined();
    });

    it('should have Admin link appear before the user menu for admins', () => {
      renderWithProviders(mockAuthContext);
      
      const adminLink = screen.getByRole('link', { name: /admin/i });
      const userMenuButton = screen.getByTestId('user-menu-button');
      
      expect(adminLink).toBeInTheDocument();
      expect(userMenuButton).toBeInTheDocument();
    });
  });

  describe('Phase 4: Remove admin links from dropdown', () => {
    it('should NOT display Cinemas link in dropdown menu', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // Cinemas link should NOT exist in dropdown
      expect(screen.queryByTestId('admin-cinemas-link')).not.toBeInTheDocument();
    });

    it('should NOT display Settings link in dropdown menu', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // Settings link should NOT exist in dropdown
      expect(screen.queryByTestId('admin-settings-link')).not.toBeInTheDocument();
    });

    it('should NOT display Users link in dropdown menu', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // Users link should NOT exist in dropdown
      expect(screen.queryByTestId('admin-users-link')).not.toBeInTheDocument();
    });

    it('should NOT display System link in dropdown menu', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // System link should NOT exist in dropdown
      expect(screen.queryByTestId('admin-system-link')).not.toBeInTheDocument();
    });

    it('should still display Change Password link in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // Change Password link should still exist
      expect(screen.getByTestId('change-password-link')).toBeInTheDocument();
    });

    it('should still display Déconnexion button in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // Logout button should still exist
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    });

    it('should NOT display admin separator divider in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(mockAuthContext);
      
      // Open dropdown
      const userMenuButton = screen.getByTestId('user-menu-button');
      await user.click(userMenuButton);
      
      // Get all dividers in dropdown
      const dropdown = screen.getByTestId('user-dropdown-menu');
      const dividers = dropdown.querySelectorAll('.border-t');
      
      // Should only have 1 divider (before logout), not 2
      expect(dividers.length).toBe(1);
    });
  });
});
