import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SettingsPage from './SettingsPage';
import { AuthContext } from '../../contexts/AuthContext';
import { SettingsContext } from '../../contexts/SettingsContext';

// Mock API modules
vi.mock('../../api/settings', () => ({
  downloadSettingsExport: vi.fn(),
  uploadSettingsImport: vi.fn(),
  resetSettings: vi.fn(),
}));

// Import after mock to get mocked version
import { downloadSettingsExport, uploadSettingsImport, resetSettings } from '../../api/settings';

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: {
    id: 1,
    username: 'admin',
    role_id: 1,
    role_name: 'admin',
    is_system_role: true,
    permissions: ['settings:read', 'settings:update', 'settings:reset', 'settings:export', 'settings:import'],
  },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: true,
  hasPermission: vi.fn<(p: string) => boolean>(() => true),
};

const mockSettingsContext = {
  adminSettings: {
    site_name: 'Test Cinema',
    logo_base64: null,
    favicon_base64: null,
    color_primary: '#FECC00',
    color_secondary: '#1E40AF',
    color_accent: '#10B981',
    color_background: '#FFFFFF',
    color_text: '#1F2937',
    color_text_secondary: '#6B7280',
    color_border: '#E5E7EB',
    color_success: '#10B981',
    color_error: '#EF4444',
    font_family_heading: 'Playfair Display',
    font_family_body: 'Roboto',
    footer_text: '© 2024 Test Cinema',
    footer_links: [],
    email_from_name: 'Test Cinema',
    email_from_address: 'noreply@test.com',
    email_logo_base64: null,
  },
  settings: null,
  updateSettings: vi.fn(),
  refreshAdminSettings: vi.fn(),
  refreshSettings: vi.fn(),
  isLoading: false,
};

const renderWithContexts = (
  ui: React.ReactElement,
  authOverrides?: Partial<typeof mockAuthContext>,
  settingsOverrides?: Partial<typeof mockSettingsContext>
) =>
  render(
    <AuthContext.Provider value={{ ...mockAuthContext, ...authOverrides }}>
      <SettingsContext.Provider value={{ ...mockSettingsContext, ...settingsOverrides }}>
        {ui}
      </SettingsContext.Provider>
    </AuthContext.Provider>
  );

describe('SettingsPage - Permission-based button visibility', () => {
  beforeEach(() => {
    vi.mocked(downloadSettingsExport).mockResolvedValue(undefined);
    vi.mocked(uploadSettingsImport).mockResolvedValue(undefined);
    vi.mocked(resetSettings).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides Export button when user lacks settings:export permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn((p: string) => p !== 'settings:export'),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.queryByTestId('export-settings-button')).not.toBeInTheDocument();
  });

  it('shows Export button when user has settings:export permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.getByTestId('export-settings-button')).toBeInTheDocument();
  });

  it('hides Import button when user lacks settings:import permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn((p: string) => p !== 'settings:import'),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.queryByTestId('import-settings-button')).not.toBeInTheDocument();
  });

  it('shows Import button when user has settings:import permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.getByTestId('import-settings-button')).toBeInTheDocument();
  });

  it('hides Reset button when user lacks settings:reset permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn((p: string) => p !== 'settings:reset'),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.queryByTestId('reset-settings-button')).not.toBeInTheDocument();
  });

  it('shows Reset button when user has settings:reset permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.getByTestId('reset-settings-button')).toBeInTheDocument();
  });

  it('hides Save button when user lacks settings:update permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn((p: string) => p !== 'settings:update'),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.queryByTestId('save-settings-button')).not.toBeInTheDocument();
  });

  it('shows Save button when user has settings:update permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('White-Label Settings');

    expect(screen.getByTestId('save-settings-button')).toBeInTheDocument();
  });

  it('disables form inputs when user lacks settings:update permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn((p: string) => p !== 'settings:update'),
    });

    await screen.findByText('White-Label Settings');

    // Check text input is disabled
    const siteNameInput = screen.getByPlaceholderText('My Cinema Site') as HTMLInputElement;
    expect(siteNameInput.disabled).toBe(true);

    // Check textarea is disabled
    const footerTab = screen.getByText('Footer');
    footerTab.click();
    const footerTextarea = screen.getByPlaceholderText('© 2024 My Cinema Site. All rights reserved.') as HTMLTextAreaElement;
    expect(footerTextarea.disabled).toBe(true);
  });

  it('enables form inputs when user has settings:update permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('White-Label Settings');

    // Check text input is enabled
    const siteNameInput = screen.getByPlaceholderText('My Cinema Site') as HTMLInputElement;
    expect(siteNameInput.disabled).toBe(false);

    // Check textarea is enabled
    const footerTab = screen.getByText('Footer');
    footerTab.click();
    const footerTextarea = screen.getByPlaceholderText('© 2024 My Cinema Site. All rights reserved.') as HTMLTextAreaElement;
    expect(footerTextarea.disabled).toBe(false);
  });

  it('shows read-only view (no buttons, disabled inputs) when user has only settings:read permission', async () => {
    renderWithContexts(<SettingsPage />, {
      hasPermission: vi.fn((p: string) => p === 'settings:read'),
    });

    await screen.findByText('White-Label Settings');

    // Settings page should be visible
    expect(screen.getByText('White-Label Settings')).toBeInTheDocument();
    expect(screen.getByText('Test Cinema')).toBeInTheDocument();

    // But no action buttons
    expect(screen.queryByTestId('export-settings-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-settings-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reset-settings-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('save-settings-button')).not.toBeInTheDocument();

    // And all inputs should be disabled
    const siteNameInput = screen.getByPlaceholderText('My Cinema Site') as HTMLInputElement;
    expect(siteNameInput.disabled).toBe(true);
  });
});
