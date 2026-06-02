import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsContext } from './SettingsContext';
import { getPublicSettings, getAdminSettings, updateSettings as apiUpdateSettings, type AppSettings, type AppSettingsPublic, type AppSettingsUpdate } from '../api/settings';

interface SettingsProviderProps {
    children: ReactNode;
}

function toPublicSettings(settings: AppSettings): AppSettingsPublic {
    return {
        site_name: settings.site_name,
        logo_base64: settings.logo_base64,
        favicon_base64: settings.favicon_base64,
        color_primary: settings.color_primary,
        color_secondary: settings.color_secondary,
        color_accent: settings.color_accent,
        color_background: settings.color_background,
        color_text: settings.color_text,
        color_text_secondary: settings.color_text_secondary,
        color_border: settings.color_border,
        color_success: settings.color_success,
        color_error: settings.color_error,
        font_family_heading: settings.font_family_heading,
        font_family_body: settings.font_family_body,
        footer_text: settings.footer_text,
        footer_links: settings.footer_links,
    };
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [publicSettings, setPublicSettings] = useState<AppSettingsPublic | null>(null);
    const [adminSettings, setAdminSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPublic, setIsLoadingPublic] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPublicSettings = useCallback(async (showLoading: boolean) => {
        if (showLoading) {
            setIsLoading(true);
            setError(null);
        }
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

    const refreshPublicSettings = useCallback(async () => {
        await loadPublicSettings(true);
    }, [loadPublicSettings]);

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
        const timeoutId = window.setTimeout(() => {
            void loadPublicSettings(false);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [loadPublicSettings]);

    return (
        <SettingsContext.Provider
            value={{
                publicSettings,
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
