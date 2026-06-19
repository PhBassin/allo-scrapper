import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { SettingsContext } from './SettingsContext';
import {
  getPublicSettings,
  getAdminSettings,
  updateSettings as apiUpdateSettings,
  type AppSettings,
  type AppSettingsPublic,
  type AppSettingsUpdate,
} from '../api/settings';
import { getPublicFields } from '../utils/settingsMapper';

/**
 * Project an AppSettings payload onto the public-safe subset.
 * Called from both `refreshAdminSettings` and `updateSettings` to keep the
 * public cache in sync with the admin source of truth.
 */
function toPublicSettings(settings: AppSettings): AppSettingsPublic {
  return getPublicFields(settings);
}

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