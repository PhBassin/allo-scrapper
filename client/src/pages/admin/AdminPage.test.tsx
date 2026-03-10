import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';

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

// Helper to render with router
const renderWithRouter = (initialRoute = '/admin') => {
  window.history.pushState({}, 'Test', initialRoute);
  return render(
    <BrowserRouter>
      <AdminPage />
    </BrowserRouter>
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

  describe('Tab order', () => {
    it('should display tabs in correct order: Cinemas, Rapports, Users, Roles, Settings, System', () => {
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
});
