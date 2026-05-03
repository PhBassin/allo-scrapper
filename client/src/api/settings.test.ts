import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import {
  exportSettings,
  getAdminSettings,
  getPublicSettings,
  importSettings,
  resetSettings,
  updateSettings,
  type AppSettingsExport,
} from './settings';

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');

  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

const serverSettingsResponse = {
  site_name: 'Test Cinema',
  logo_base64: null,
  favicon_base64: null,
  color_primary: '#FECC00',
  color_secondary: '#1F2937',
  color_accent: '#3B82F6',
  color_background: '#F9FAFB',
  color_surface: '#FFFFFF',
  color_text_primary: '#111827',
  color_text_secondary: '#6B7280',
  color_success: '#10B981',
  color_error: '#EF4444',
  font_primary: 'Playfair Display',
  font_secondary: 'Roboto',
  footer_text: 'Footer text',
  footer_links: [],
};

const fullServerSettingsResponse = {
  id: 1,
  ...serverSettingsResponse,
  email_from_name: 'Test Cinema',
  email_from_address: 'noreply@test.local',
  email_logo_base64: null,
  scrape_mode: 'weekly' as const,
  scrape_days: 7,
  updated_at: '2026-05-01T14:00:00Z',
  updated_by: 42,
};

describe('settings API client compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes server public settings into the legacy client theme shape', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: serverSettingsResponse,
      },
    });

    const result = await getPublicSettings();

    expect(apiClient.get).toHaveBeenCalledWith('/settings');
    expect(result.color_text).toBe('#111827');
    expect(result.color_border).toBe('#FFFFFF');
    expect(result.font_family_heading).toBe('Playfair Display');
    expect(result.font_family_body).toBe('Roboto');
  });

  it('uses tenant-scoped public settings endpoints on org routes', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme',
      },
    });

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: serverSettingsResponse,
      },
    });

    await getPublicSettings();

    expect(apiClient.get).toHaveBeenCalledWith('/org/acme/settings');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('normalizes full admin settings into the legacy client theme shape', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    const result = await getAdminSettings();

    expect(apiClient.get).toHaveBeenCalledWith('/settings/admin');
    expect(result.updated_by).toBe(42);
    expect(result.color_text).toBe('#111827');
    expect(result.color_border).toBe('#FFFFFF');
    expect(result.font_family_heading).toBe('Playfair Display');
    expect(result.font_family_body).toBe('Roboto');
  });

  it('uses tenant-scoped admin settings endpoints on org admin routes', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    const result = await getAdminSettings();

    expect(apiClient.get).toHaveBeenCalledWith('/org/acme/settings/admin');
    expect(result.updated_by).toBe(42);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('maps legacy white-label fields to the server update contract', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    await updateSettings({
      color_text: '#222222',
      color_border: '#F3F4F6',
      font_family_heading: 'Poppins',
      font_family_body: 'Inter',
      site_name: 'Updated Cinema',
    });

    expect(apiClient.put).toHaveBeenCalledWith('/settings', {
      color_text_primary: '#222222',
      color_surface: '#F3F4F6',
      font_primary: 'Poppins',
      font_secondary: 'Inter',
      site_name: 'Updated Cinema',
    });
  });

  it('uses tenant-scoped update settings endpoints on org admin routes', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    await updateSettings({ site_name: 'Tenant Updated Cinema' });

    expect(apiClient.put).toHaveBeenCalledWith('/org/acme/settings/admin', {
      site_name: 'Tenant Updated Cinema',
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('normalizes reset responses after the server returns the new theme contract', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    const result = await resetSettings();

    expect(apiClient.post).toHaveBeenCalledWith('/settings/reset');
    expect(result.color_text).toBe('#111827');
    expect(result.color_border).toBe('#FFFFFF');
  });

  it('uses tenant-scoped reset settings endpoints on org admin routes', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    await resetSettings();

    expect(apiClient.post).toHaveBeenCalledWith('/org/acme/settings/admin/reset');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('normalizes exported settings into the legacy client theme shape before download/import round-trips', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          version: '1.0',
          exported_at: '2026-05-01T14:00:00Z',
          exported_by: 'tester',
          settings: fullServerSettingsResponse,
        },
      },
    });

    const result = await exportSettings();

    expect(apiClient.post).toHaveBeenCalledWith('/settings/export');
    expect(result.settings.color_text).toBe('#111827');
    expect(result.settings.color_border).toBe('#FFFFFF');
    expect(result.settings.font_family_heading).toBe('Playfair Display');
    expect(result.settings.font_family_body).toBe('Roboto');
  });

  it('uses tenant-scoped export settings endpoints on org admin routes', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          version: '1.0',
          exported_at: '2026-05-01T14:00:00Z',
          exported_by: 'tester',
          settings: fullServerSettingsResponse,
        },
      },
    });

    await exportSettings();

    expect(apiClient.post).toHaveBeenCalledWith('/org/acme/settings/export');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('normalizes import payloads and responses after the server returns the new theme contract', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    const payload: AppSettingsExport = {
      version: '1.0',
      exported_at: '2026-05-01T14:00:00Z',
      exported_by: 'tester',
      settings: {
        ...fullServerSettingsResponse,
        color_text: '#111827',
        color_border: '#FFFFFF',
        font_family_heading: 'Playfair Display',
        font_family_body: 'Roboto',
      },
    };

    const result = await importSettings(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/settings/import', payload);
    expect(result.font_family_heading).toBe('Playfair Display');
    expect(result.font_family_body).toBe('Roboto');
  });

  it('uses tenant-scoped import settings endpoints on org admin routes', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: fullServerSettingsResponse,
      },
    });

    const payload: AppSettingsExport = {
      version: '1.0',
      exported_at: '2026-05-01T14:00:00Z',
      exported_by: 'tester',
      settings: {
        ...fullServerSettingsResponse,
        color_text: '#111827',
        color_border: '#FFFFFF',
        font_family_heading: 'Playfair Display',
        font_family_body: 'Roboto',
      },
    };

    await importSettings(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/org/acme/settings/import', payload);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
