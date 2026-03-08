import { useEffect, useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

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

  useEffect(() => {
    // Inject theme.css stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/api/theme.css';
    link.id = 'dynamic-theme';
    document.head.appendChild(link);

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
