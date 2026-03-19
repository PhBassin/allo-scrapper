import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { mockPublicSettings } from '../test-utils/mockSettings';

const mockAuthContext = {
  isAuthenticated: false,
  user: null,
  logout: vi.fn(),
  login: vi.fn(),
  isAdmin: false,
  hasPermission: vi.fn(() => false),
  token: null,
};

const mockSettingsContext = {
  publicSettings: mockPublicSettings,
  adminSettings: null,
  isLoading: false,
  isLoadingPublic: false,
  error: null,
  refreshPublicSettings: vi.fn(),
  refreshAdminSettings: vi.fn(),
  updateSettings: vi.fn(),
};

describe('Header Stickiness', () => {
  it('should have sticky classes on the header element', () => {
    render(
      <BrowserRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <SettingsContext.Provider value={mockSettingsContext}>
            <Layout>Test Content</Layout>
          </SettingsContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-50');
  });
});
