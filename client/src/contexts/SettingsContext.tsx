import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getPublicSettings, getAdminSettings, updateSettings as apiUpdateSettings, type AppSettings, type AppSettingsPublic, type AppSettingsUpdate } from '../api/settings';

interface SettingsContextType {
    // Public settings (available to all users)
    publicSettings: AppSettingsPublic | null;
    
    // Full settings (admin only)
    adminSettings: AppSettings | null;
    
    // Loading states
    isLoading: boolean;
    error: string | null;
    
    // Actions
    refreshPublicSettings: () => Promise<void>;
    refreshAdminSettings: () => Promise<void>;
    updateSettings: (updates: AppSettingsUpdate) => Promise<AppSettings>;
}

export const SettingsContext = createContext<SettingsContextType>({
    publicSettings: null,
    adminSettings: null,
    isLoading: false,
    error: null,
    refreshPublicSettings: async () => {},
    refreshAdminSettings: async () => {},
    updateSettings: async () => { throw new Error('Not implemented'); },
});

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [publicSettings, setPublicSettings] = useState<AppSettingsPublic | null>(null);
    const [adminSettings, setAdminSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch public settings (no auth required)
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
        }
    }, []);

    // Fetch admin settings (admin only)
    const refreshAdminSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await getAdminSettings();
            setAdminSettings(settings);
            // Also update public settings subset
            setPublicSettings({
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
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load admin settings';
            setError(message);
            console.error('Error loading admin settings:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Update settings (admin only)
    const updateSettings = useCallback(async (updates: AppSettingsUpdate): Promise<AppSettings> => {
        setIsLoading(true);
        setError(null);
        try {
            const updatedSettings = await apiUpdateSettings(updates);
            setAdminSettings(updatedSettings);
            // Also update public settings subset
            setPublicSettings({
                site_name: updatedSettings.site_name,
                logo_base64: updatedSettings.logo_base64,
                favicon_base64: updatedSettings.favicon_base64,
                color_primary: updatedSettings.color_primary,
                color_secondary: updatedSettings.color_secondary,
                color_accent: updatedSettings.color_accent,
                color_background: updatedSettings.color_background,
                color_text: updatedSettings.color_text,
                color_text_secondary: updatedSettings.color_text_secondary,
                color_border: updatedSettings.color_border,
                color_success: updatedSettings.color_success,
                color_error: updatedSettings.color_error,
                font_family_heading: updatedSettings.font_family_heading,
                font_family_body: updatedSettings.font_family_body,
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

    // Load public settings on mount
    useEffect(() => {
        refreshPublicSettings();
    }, [refreshPublicSettings]);

    return (
        <SettingsContext.Provider
            value={{
                publicSettings,
                adminSettings,
                isLoading,
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
