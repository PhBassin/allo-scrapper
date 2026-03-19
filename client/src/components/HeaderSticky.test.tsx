import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';

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
  publicSettings: {
    site_name: 'Allo-Scrapper',
    logo_base64: null,
    favicon_base64: null,
    color_primary: '#1976d2',
    color_secondary: '#dc004e',
    color_accent: '#ff9800',
    color_background: '#ffffff',
    color_text_primary: '#000000',
    color_text_secondary: '#666666',
    color_surface: '#e0e0e0',
    color_success: '#4caf50',
    color_error: '#f44336',
    font_primary: 'Roboto',
    font_secondary: 'Roboto',
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
