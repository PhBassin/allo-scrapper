import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsContext } from './SettingsContext';
import { getPublicSettings, getAdminSettings, updateSettings as apiUpdateSettings, toPublicSettings, type AppSettings, type AppSettingsPublic, type AppSettingsUpdate } from '../api/settings';

/**
 * Default public settings used as fallback when the backend fails to return
 * the app_settings row (e.g. missing row after silent migration failure).
 * Values match the DEFAULTs defined in migration 004_add_app_settings.sql.
 */
export const DEFAULT_PUBLIC_SETTINGS: AppSettingsPublic = {
  site_name: 'Allo-Scrapper',
  logo_base64: null,
  favicon_base64: null,
  color_primary: '#FECC00',
  color_secondary: '#1F2937',
  color_accent: '#F59E0B',
  color_background: '#FFFFFF',
  color_surface: '#F3F4F6',
  color_text_primary: '#111827',
  color_text_secondary: '#6B7280',
  color_success: '#10B981',
  color_error: '#EF4444',
  font_primary: 'Inter',
  font_secondary: 'Roboto',
  footer_text: null,
  footer_links: [],
};

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [publicSettings, setPublicSettings] = useState<AppSettingsPublic | null>(null);
    const [adminSettings, setAdminSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPublic, setIsLoadingPublic] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshPublicSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await getPublicSettings();
            setPublicSettings(settings);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load settings';
            setError(message);
            console.error('Error loading public settings:', err);
        } finally {
            setIsLoading(false);
            setIsLoadingPublic(false);
        }
    }, []);

    const refreshAdminSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await getAdminSettings();
            setAdminSettings(settings);
            setPublicSettings(toPublicSettings(settings));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load admin settings';
            setError(message);
            console.error('Error loading admin settings:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (updates: AppSettingsUpdate): Promise<AppSettings> => {
        setIsLoading(true);
        setError(null);
        try {
            const updatedSettings = await apiUpdateSettings(updates);
            setAdminSettings(updatedSettings);
            setPublicSettings(toPublicSettings(updatedSettings));
            return updatedSettings;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update settings';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPublicSettings();
    }, [refreshPublicSettings]);

    return (
        <SettingsContext.Provider
            value={{
                publicSettings: publicSettings ?? DEFAULT_PUBLIC_SETTINGS,
                adminSettings,
                isLoading,
                isLoadingPublic,
                error,
                refreshPublicSettings,
                refreshAdminSettings,
                updateSettings,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};
