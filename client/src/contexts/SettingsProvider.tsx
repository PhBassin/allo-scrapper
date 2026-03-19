import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsContext } from './SettingsContext';
import { getPublicSettings, getAdminSettings, updateSettings as apiUpdateSettings, type AppSettings, type AppSettingsPublic, type AppSettingsUpdate } from '../api/settings';

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
            setPublicSettings({
                site_name: settings.site_name,
                logo_base64: settings.logo_base64,
                favicon_base64: settings.favicon_base64,
                color_primary: settings.color_primary,
                color_secondary: settings.color_secondary,
                color_accent: settings.color_accent,
                color_background: settings.color_background,
                color_surface: settings.color_surface,
                color_text_primary: settings.color_text_primary_primary,
                color_text_secondary: settings.color_text_secondary,
                color_success: settings.color_success,
                color_error: settings.color_error,
                color_primary_dark: settings.color_primary_dark,
                color_secondary_dark: settings.color_secondary_dark,
                color_accent_dark: settings.color_accent_dark,
                color_background_dark: settings.color_background_dark,
                color_surface_dark: settings.color_surface_dark,
                color_text_primary_dark: settings.color_text_primary_primary_dark,
                color_text_secondary_dark: settings.color_text_secondary_dark,
                color_success_dark: settings.color_success_dark,
                color_error_dark: settings.color_error_dark,
                font_primary: settings.font_primary,
                font_secondary: settings.font_secondary,
                footer_text: settings.footer_text,
                footer_links: settings.footer_links,
            });
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
            setPublicSettings({
                site_name: updatedSettings.site_name,
                logo_base64: updatedSettings.logo_base64,
                favicon_base64: updatedSettings.favicon_base64,
                color_primary: updatedSettings.color_primary,
                color_secondary: updatedSettings.color_secondary,
                color_accent: updatedSettings.color_accent,
                color_background: updatedSettings.color_background,
                color_surface: updatedSettings.color_surface,
                color_text_primary: updatedSettings.color_text_primary_primary,
                color_text_secondary: updatedSettings.color_text_secondary,
                color_success: updatedSettings.color_success,
                color_error: updatedSettings.color_error,
                color_primary_dark: updatedSettings.color_primary_dark,
                color_secondary_dark: updatedSettings.color_secondary_dark,
                color_accent_dark: updatedSettings.color_accent_dark,
                color_background_dark: updatedSettings.color_background_dark,
                color_surface_dark: updatedSettings.color_surface_dark,
                color_text_primary_dark: updatedSettings.color_text_primary_primary_dark,
                color_text_secondary_dark: updatedSettings.color_text_secondary_dark,
                color_success_dark: updatedSettings.color_success_dark,
                color_error_dark: updatedSettings.color_error_dark,
                font_primary: updatedSettings.font_primary,
                font_secondary: updatedSettings.font_secondary,
                footer_text: updatedSettings.footer_text,
                footer_links: updatedSettings.footer_links,
            });
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
