import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useTheme } from './useTheme';
import { SettingsContext } from '../contexts/SettingsContext';
import type { AppSettingsPublic } from '../api/settings';

describe('useTheme', () => {
  let stylesheetElement: HTMLLinkElement | null = null;
  let faviconElement: HTMLLinkElement | null = null;

  const createWrapper = (publicSettings: AppSettingsPublic | null = null) => {
    const mockContextValue = {
      publicSettings,
      adminSettings: null,
      isLoading: false,
      isLoadingPublic: false,
      error: null,
      refreshPublicSettings: vi.fn(),
      refreshAdminSettings: vi.fn(),
      updateSettings: vi.fn(),
    };

    return ({ children }: { children: React.ReactNode }) => (
      <SettingsContext.Provider value={mockContextValue}>
        {children}
      </SettingsContext.Provider>
    );
  };

  beforeEach(() => {
    // Clear document head
    document.head.innerHTML = '';
    document.title = 'Test App';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
  });

  it('should inject theme.css link element on mount', async () => {
    renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => {
      stylesheetElement = document.querySelector('link[href*="theme.css"]');
      expect(stylesheetElement).not.toBeNull();
      expect(stylesheetElement?.rel).toBe('stylesheet');
      expect(stylesheetElement?.href).toContain('/api/theme.css');
    });
  });

  it('should update favicon when publicSettings includes favicon_base64', async () => {
    const mockSettings: AppSettingsPublic = {
      site_name: 'My Cinema',
      favicon_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      logo_base64: null,
      color_primary: '#FECC00',
      color_secondary: '#1F2937',
      color_accent: '#3B82F6',
      color_background: '#FFFFFF',
      color_text_primary: '#1F2937',
      color_text_secondary: '#6B7280',
      color_surface: '#E5E7EB',
      color_success: '#10B981',
      color_error: '#EF4444',
      font_primary: 'Inter',
      font_secondary: 'Inter',
      footer_text: 'Footer',
      footer_links: [],
    };

    renderHook(() => useTheme(), { wrapper: createWrapper(mockSettings) });

    await waitFor(() => {
      faviconElement = document.querySelector('link[rel="icon"]');
      expect(faviconElement).not.toBeNull();
      expect(faviconElement?.href).toBe(mockSettings.favicon_base64);
    });
  });

  it('should update document title when publicSettings includes site_name', async () => {
    const mockSettings: AppSettingsPublic = {
      site_name: 'My Custom Cinema Site',
      favicon_base64: null,
      logo_base64: null,
      color_primary: '#FECC00',
      color_secondary: '#1F2937',
      color_accent: '#3B82F6',
      color_background: '#FFFFFF',
      color_text_primary: '#1F2937',
      color_text_secondary: '#6B7280',
      color_surface: '#E5E7EB',
      color_success: '#10B981',
      color_error: '#EF4444',
      font_primary: 'Inter',
      font_secondary: 'Inter',
      footer_text: 'Footer',
      footer_links: [],
    };

    renderHook(() => useTheme(), { wrapper: createWrapper(mockSettings) });

    await waitFor(() => {
      expect(document.title).toBe('My Custom Cinema Site');
    });
  });

  it('should not crash if publicSettings is null', async () => {
    renderHook(() => useTheme(), { wrapper: createWrapper(null) });

    // Hook should not throw - just verify theme.css is injected
    await waitFor(() => {
      stylesheetElement = document.querySelector('link[href*="theme.css"]');
      expect(stylesheetElement).not.toBeNull();
    });
  });

  it('should use default title if site_name is not provided', async () => {
    const originalTitle = document.title;
    
    renderHook(() => useTheme(), { wrapper: createWrapper(null) });

    await waitFor(() => {
      // Title should not change if site_name is not provided
      expect(document.title).toBe(originalTitle);
    });
  });

  it('should cleanup theme.css link on unmount', async () => {
    const { unmount } = renderHook(() => useTheme(), { wrapper: createWrapper() });

    await waitFor(() => {
      stylesheetElement = document.querySelector('link[href*="theme.css"]');
      expect(stylesheetElement).not.toBeNull();
    });

    unmount();

    await waitFor(() => {
      stylesheetElement = document.querySelector('link[href*="theme.css"]');
      expect(stylesheetElement).toBeNull();
    });
  });
});
