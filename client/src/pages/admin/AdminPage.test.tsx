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
      const cinemasTab = screen.getByRole('button', { name: /cinemas/i });
      expect(cinemasTab).toHaveClass('border-primary');
      
      // Cinemas content should be visible
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
    });
  });

  describe('Tab navigation via URL', () => {
    it('should display Rapports tab when URL has ?tab=rapports', () => {
      renderWithRouter('/admin?tab=rapports');
      
      const rapportsTab = screen.getByRole('button', { name: /rapports/i });
      expect(rapportsTab).toHaveClass('border-primary');
      expect(screen.getByTestId('reports-content')).toBeInTheDocument();
    });

    it('should display Users tab when URL has ?tab=users', () => {
      renderWithRouter('/admin?tab=users');
      
      const usersTab = screen.getByRole('button', { name: /users/i });
      expect(usersTab).toHaveClass('border-primary');
      expect(screen.getByTestId('users-content')).toBeInTheDocument();
    });

    it('should display Settings tab when URL has ?tab=settings', () => {
      renderWithRouter('/admin?tab=settings');
      
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      expect(settingsTab).toHaveClass('border-primary');
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });

    it('should display System tab when URL has ?tab=system', () => {
      renderWithRouter('/admin?tab=system');
      
      const systemTab = screen.getByRole('button', { name: /system/i });
      expect(systemTab).toHaveClass('border-primary');
      expect(screen.getByTestId('system-content')).toBeInTheDocument();
    });

    it('should fallback to Cinemas tab when invalid tab param is provided', () => {
      renderWithRouter('/admin?tab=invalid');
      
      const cinemasTab = screen.getByRole('button', { name: /cinemas/i });
      expect(cinemasTab).toHaveClass('border-primary');
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
    });
  });

  describe('Tab click interaction', () => {
    it('should update URL when clicking on a different tab', () => {
      renderWithRouter('/admin');
      
      // Click on Users tab
      const usersTab = screen.getByRole('button', { name: /users/i });
      fireEvent.click(usersTab);
      
      // URL should be updated
      expect(window.location.search).toBe('?tab=users');
    });

    it('should display correct content after clicking tab', () => {
      renderWithRouter('/admin');
      
      // Initially shows Cinemas
      expect(screen.getByTestId('cinemas-content')).toBeInTheDocument();
      
      // Click on Settings tab
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsTab);
      
      // Should now show Settings
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      expect(screen.queryByTestId('cinemas-content')).not.toBeInTheDocument();
    });
  });

  describe('Tab icons', () => {
    it('should display icons for each tab', () => {
      renderWithRouter('/admin');
      
      const cinemasTab = screen.getByRole('button', { name: /cinemas/i });
      const rapportsTab = screen.getByRole('button', { name: /rapports/i });
      const usersTab = screen.getByRole('button', { name: /users/i });
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      const systemTab = screen.getByRole('button', { name: /system/i });
      
      // Each tab should have an SVG icon
      expect(cinemasTab.querySelector('svg')).toBeInTheDocument();
      expect(rapportsTab.querySelector('svg')).toBeInTheDocument();
      expect(usersTab.querySelector('svg')).toBeInTheDocument();
      expect(settingsTab.querySelector('svg')).toBeInTheDocument();
      expect(systemTab.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Active tab styling', () => {
    it('should apply active styles to the current tab', () => {
      renderWithRouter('/admin?tab=settings');
      
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      const cinemasTab = screen.getByRole('button', { name: /cinemas/i });
      
      // Settings tab should have active classes
      expect(settingsTab).toHaveClass('border-primary', 'text-primary');
      
      // Other tabs should have inactive classes
      expect(cinemasTab).toHaveClass('text-gray-500');
      expect(cinemasTab).not.toHaveClass('border-primary');
    });
  });

  describe('Tab order', () => {
    it('should display tabs in correct order: Cinemas, Rapports, Users, Settings, System', () => {
      renderWithRouter('/admin');
      
      const tabs = screen.getAllByRole('button');
      
      expect(tabs[0]).toHaveTextContent(/cinemas/i);
      expect(tabs[1]).toHaveTextContent(/rapports/i);
      expect(tabs[2]).toHaveTextContent(/users/i);
      expect(tabs[3]).toHaveTextContent(/settings/i);
      expect(tabs[4]).toHaveTextContent(/system/i);
    });
  });
});
