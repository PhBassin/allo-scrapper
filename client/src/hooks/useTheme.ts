import { useEffect, useContext, useMemo } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

function getThemePath(): string {
  if (typeof window === 'undefined') {
    return '/api/theme.css';
  }

  const orgMatch = window.location.pathname.match(/^\/org\/([^/]+)/);
  if (!orgMatch) {
    return '/api/theme.css';
  }

  return `/api/org/${encodeURIComponent(orgMatch[1])}/settings/theme.css`;
}

function buildThemeHref(themeVersion: string): string {
  return `${getThemePath()}?v=${encodeURIComponent(themeVersion)}`;
}

/**
 * Custom hook that applies white-label theme globally:
 * 1. Injects /api/theme.css stylesheet for dynamic CSS variables
 * 2. Updates favicon dynamically from settings
 * 3. Updates document title with site name
 * 
 * This hook should be called once at the app root level.
 */
export function useTheme() {
  const { publicSettings } = useContext(SettingsContext);
  const themeVersion = useMemo(() => [
    publicSettings?.site_name ?? '',
    publicSettings?.color_primary ?? '',
    publicSettings?.color_secondary ?? '',
    publicSettings?.color_accent ?? '',
    publicSettings?.color_background ?? '',
    publicSettings?.color_text ?? '',
    publicSettings?.color_text_secondary ?? '',
    publicSettings?.color_border ?? '',
    publicSettings?.color_success ?? '',
    publicSettings?.color_error ?? '',
    publicSettings?.font_family_heading ?? '',
    publicSettings?.font_family_body ?? '',
    publicSettings?.footer_text ?? '',
    publicSettings?.footer_links?.map((link) => `${link.label}:${link.url}`).join(',') ?? '',
  ].join('|') || 'default-theme', [publicSettings]);

  useEffect(() => {
    let themeLink = document.querySelector<HTMLLinkElement>('#dynamic-theme');

    if (!themeLink) {
      themeLink = document.createElement('link');
      themeLink.rel = 'stylesheet';
      themeLink.id = 'dynamic-theme';
      document.head.appendChild(themeLink);
    }

    themeLink.href = buildThemeHref(themeVersion);
  }, [themeVersion]);

  useEffect(() => {
    // Cleanup: remove stylesheet on unmount
    return () => {
      const themeLink = document.getElementById('dynamic-theme');
      if (themeLink) {
        themeLink.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Update favicon if provided
    if (publicSettings?.favicon_base64) {
      let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      
      faviconLink.href = publicSettings.favicon_base64;
    }

    // Update document title if provided
    if (publicSettings?.site_name) {
      document.title = publicSettings.site_name;
    }
  }, [publicSettings]);
}
