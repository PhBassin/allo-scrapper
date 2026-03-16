import { createContext } from 'react';
import type { AppSettings, AppSettingsPublic, AppSettingsUpdate } from '../api/settings';

export interface SettingsContextType {
    publicSettings: AppSettingsPublic | null;
    adminSettings: AppSettings | null;
    isLoading: boolean;
    isLoadingPublic: boolean;
    error: string | null;
    refreshPublicSettings: () => Promise<void>;
    refreshAdminSettings: () => Promise<void>;
    updateSettings: (updates: AppSettingsUpdate) => Promise<AppSettings>;
}

export const SettingsContext = createContext<SettingsContextType>({
    publicSettings: null,
    adminSettings: null,
    isLoading: false,
    isLoadingPublic: true,
    error: null,
    refreshPublicSettings: async () => {},
    refreshAdminSettings: async () => {},
    updateSettings: async () => { throw new Error('Not implemented'); },
});
