import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';
import { AuthContext } from '../../contexts/AuthContext';
import type { User } from '../../contexts/AuthContext';

// Mock child pages
vi.mock('./CinemasPage', () => ({
  default: () => <div data-testid="cinemas-content">Cinemas Page</div>,
}));

vi.mock('./SettingsPage', () => ({
  default: () => <div data-testid="settings-content">Settings Page</div>,
}));

vi.mock('./UsersPage', () => ({
  default: () => <div data-testid="users-content">Users Page</div>,
}));

vi.mock('./SystemPage', () => ({
  default: () => <div data-testid="system-content">System Page</div>,
}));

vi.mock('../ReportsPage', () => ({
  default: () => <div data-testid="reports-content">Reports Page</div>,
}));

vi.mock('../../components/admin/RoleManagementPage', () => ({
  default: () => <div data-testid="roles-content">Roles Page</div>,
}));

const adminUser: User = {
  id: 1,
  username: 'admin',
  role_id: 1,
  role_name: 'admin',
  permissions: [],
};

const operatorUser: User = {
  id: 2,
  username: 'operator',
  role_id: 2,
  role_name: 'operator',
  permissions: [
    'scraper:trigger',
    'scraper:trigger_single',
    'cinemas:create',
    'cinemas:update',
    'cinemas:delete',
    'reports:list',
    'reports:view',
  ],
};

const makeAuthContext = (user: User) => ({
  isAuthenticated: true,
  token: 'mock-token',
  user,
  isAdmin: user.role_name === 'admin',
  hasPermission: (permission: string) =>
    user.role_name === 'admin' || user.permissions.includes(permission),
  login: vi.fn(),
  logout: vi.fn(),
});

// Helper to render with router and optional auth context
const renderWithRouter = (initialRoute = '/admin', user: User = adminUser) => {
  window.history.pushState({}, 'Test', initialRoute);
  return render(
    <AuthContext.Provider value={makeAuthContext(user)}>
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('AdminPage', () => {
  beforeEach(() => {
    // Reset history before each test
    window.history.pushState({}, 'Test', '/admin');
  });

  describe('Default tab display', () => {
    it('should display Cinemas tab by default when no tab param is provided', () => {
      renderWithRouter('/admin');

      // Cinemas tab should be active
      const cinemasTab = screen.getByRole('tab', { name: 'Cinemas' });
      expect(cinemasTab).toHaveClass('border-primary');

      // Cinemas content should be visible
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
    });
  });

  describe('Tab navigation via URL', () => {
    it('should display Rapports tab when URL has ?tab=rapports', () => {
      renderWithRouter('/admin?tab=rapports');

      const rapportsTab = screen.getByRole('tab', { name: 'Rapports' });
      expect(rapportsTab).toHaveClass('border-primary');
      expect(screen.getByTestId('reports-content')).toBeInTheDocument();
    });

    it('should display Users tab when URL has ?tab=users', () => {
      renderWithRouter('/admin?tab=users');

      const usersTab = screen.getByRole('tab', { name: 'Users' });
      expect(usersTab).toHaveClass('border-primary');
      expect(screen.getByTestId('users-content')).toBeInTheDocument();
    });

    it('should display Roles tab when URL has ?tab=roles', () => {
      renderWithRouter('/admin?tab=roles');

      const rolesTab = screen.getByRole('tab', { name: 'Roles' });
      expect(rolesTab).toHaveClass('border-primary');
      expect(screen.getByTestId('roles-content')).toBeInTheDocument();
    });

    it('should display Settings tab when URL has ?tab=settings', () => {
      renderWithRouter('/admin?tab=settings');

      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      expect(settingsTab).toHaveClass('border-primary');
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });

    it('should display System tab when URL has ?tab=system', () => {
      renderWithRouter('/admin?tab=system');

      const systemTab = screen.getByRole('tab', { name: 'System' });
      expect(systemTab).toHaveClass('border-primary');
      expect(screen.getByTestId('system-content')).toBeInTheDocument();
    });

    it('should fallback to Cinemas tab when invalid tab param is provided', () => {
      renderWithRouter('/admin?tab=invalid');

      const cinemasTab = screen.getByRole('tab', { name: 'Cinemas' });
      expect(cinemasTab).toHaveClass('border-primary');
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
    });
  });

  describe('Tab click interaction', () => {
    it('should update URL when clicking on a different tab', () => {
      renderWithRouter('/admin');

      // Click on Users tab
      const usersTab = screen.getByRole('tab', { name: 'Users' });
      fireEvent.click(usersTab);

      // URL should be updated
      expect(window.location.search).toBe('?tab=users');
    });

    it('should navigate to Roles tab when clicked', () => {
      renderWithRouter('/admin');

      const rolesTab = screen.getByRole('tab', { name: 'Roles' });
      fireEvent.click(rolesTab);

      expect(window.location.search).toBe('?tab=roles');
      expect(screen.getByTestId('roles-content')).toBeInTheDocument();
    });

    it('should display correct content after clicking tab', () => {
      renderWithRouter('/admin');

      // Initially shows Cinemas
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();

      // Click on Settings tab
      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      fireEvent.click(settingsTab);

      // Should now show Settings
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      expect(screen.queryByTestId('cinemas-content')).not.toBeInTheDocument();
    });
  });

  describe('Tab icons', () => {
    it('should display icons for each tab', () => {
      renderWithRouter('/admin');

      const cinemasTab = screen.getByRole('tab', { name: 'Cinemas' });
      const rapportsTab = screen.getByRole('tab', { name: 'Rapports' });
      const usersTab = screen.getByRole('tab', { name: 'Users' });
      const rolesTab = screen.getByRole('tab', { name: 'Roles' });
      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      const systemTab = screen.getByRole('tab', { name: 'System' });

      // Each tab should have an SVG icon
      expect(cinemasTab.querySelector('svg')).toBeInTheDocument();
      expect(rapportsTab.querySelector('svg')).toBeInTheDocument();
      expect(usersTab.querySelector('svg')).toBeInTheDocument();
      expect(rolesTab.querySelector('svg')).toBeInTheDocument();
      expect(settingsTab.querySelector('svg')).toBeInTheDocument();
      expect(systemTab.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Active tab styling', () => {
    it('should apply active styles to the current tab', () => {
      renderWithRouter('/admin?tab=settings');

      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      const cinemasTab = screen.getByRole('tab', { name: 'Cinemas' });

      // Settings tab should have active classes
      expect(settingsTab).toHaveClass('border-primary', 'text-primary');

      // Other tabs should have inactive classes
      expect(cinemasTab).toHaveClass('text-gray-500');
      expect(cinemasTab).not.toHaveClass('border-primary');
    });
  });

  describe('Tab order (admin)', () => {
    it('should display all 6 tabs in correct order for admin: Cinemas, Rapports, Users, Roles, Settings, System', () => {
      renderWithRouter('/admin');

      const tabs = screen.getAllByRole('tab');

      expect(tabs[0]).toHaveTextContent('Cinemas');
      expect(tabs[1]).toHaveTextContent('Rapports');
      expect(tabs[2]).toHaveTextContent('Users');
      expect(tabs[3]).toHaveTextContent('Roles');
      expect(tabs[4]).toHaveTextContent('Settings');
      expect(tabs[5]).toHaveTextContent('System');
    });
  });

  describe('Operator role - tab visibility', () => {
    it('should only show Cinemas and Rapports tabs for operator', () => {
      renderWithRouter('/admin', operatorUser);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveTextContent('Cinemas');
      expect(tabs[1]).toHaveTextContent('Rapports');
    });

    it('should NOT show Users tab for operator', () => {
      renderWithRouter('/admin', operatorUser);

      expect(screen.queryByRole('tab', { name: 'Users' })).not.toBeInTheDocument();
    });

    it('should NOT show Roles tab for operator', () => {
      renderWithRouter('/admin', operatorUser);

      expect(screen.queryByRole('tab', { name: 'Roles' })).not.toBeInTheDocument();
    });

    it('should NOT show Settings tab for operator', () => {
      renderWithRouter('/admin', operatorUser);

      expect(screen.queryByRole('tab', { name: 'Settings' })).not.toBeInTheDocument();
    });

    it('should NOT show System tab for operator', () => {
      renderWithRouter('/admin', operatorUser);

      expect(screen.queryByRole('tab', { name: 'System' })).not.toBeInTheDocument();
    });

    it('should show Cinemas content by default for operator', () => {
      renderWithRouter('/admin', operatorUser);

      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
    });

    it('should redirect operator from a forbidden tab (users) to cinemas', () => {
      renderWithRouter('/admin?tab=users', operatorUser);

      // Should fall back to cinemas content since users tab is not allowed
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
      expect(screen.queryByTestId('users-content')).not.toBeInTheDocument();
    });

    it('should redirect operator from a forbidden tab (roles) to cinemas', () => {
      renderWithRouter('/admin?tab=roles', operatorUser);

      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
      expect(screen.queryByTestId('roles-content')).not.toBeInTheDocument();
    });

    it('should redirect operator from a forbidden tab (settings) to cinemas', () => {
      renderWithRouter('/admin?tab=settings', operatorUser);

      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();
    });

    it('should redirect operator from a forbidden tab (system) to cinemas', () => {
      renderWithRouter('/admin?tab=system', operatorUser);

      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
      expect(screen.queryByTestId('system-content')).not.toBeInTheDocument();
    });

    it('should allow operator to navigate to rapports tab', () => {
      renderWithRouter('/admin?tab=rapports', operatorUser);

      expect(screen.getByTestId('reports-content')).toBeInTheDocument();
    });
  });
});
