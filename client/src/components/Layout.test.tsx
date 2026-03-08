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
  user: { id: 1, username: 'admin', role: 'admin' as const },
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

const mockNonAdminAuthContext = {
  isAuthenticated: true,
  isAdmin: false,
  user: { id: 2, username: 'user', role: 'user' as const },
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

const mockSettingsContext = {
  publicSettings: {
    site_name: 'Test Cinema',
    footer_text: 'Test Footer',
    footer_links: [],
  },
  loadPublicSettings: vi.fn(),
};

const renderWithProviders = (authContext = mockAuthContext) => {
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
