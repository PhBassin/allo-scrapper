import { useState, useEffect, useContext } from 'react';
import {
  downloadSettingsExport,
  uploadSettingsImport,
  resetSettings,
  type AppSettings,
  type AppSettingsUpdate,
} from '../api/settings';
import { SettingsContext } from '../contexts/SettingsContext';
import { getPublicFields } from '../utils/settingsMapper';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

const SUCCESS_DISMISS_MS = 3000;

/**
 * Pick the editable subset of AppSettings into an AppSettingsUpdate payload.
 * Shares the public-field extraction with SettingsProvider via `getPublicFields`.
 */
function getInitialFormData(settings: AppSettings | null): AppSettingsUpdate {
  if (!settings) return {};
  return {
    ...getPublicFields(settings),
    email_from_name: settings.email_from_name,
    email_from_address: settings.email_from_address,
    email_logo_base64: settings.email_logo_base64,
  };
}

export interface UseSettingsFormResult {
  formData: AppSettingsUpdate;
  hasChanges: boolean;
  setHasChanges: (value: boolean) => void;
  handleFieldChange: <K extends keyof AppSettingsUpdate>(
    field: K,
    value: AppSettingsUpdate[K]
  ) => void;
  saveStatus: SaveStatus;
  errorMessage: string | null;
  isLoading: boolean;
  handleSave: () => Promise<void>;
  handleReset: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

/**
 * Encapsulates all settings-page state: form data, dirty flag, save status,
 * and the save/reset/export/import action handlers.
 */
export function useSettingsForm(): UseSettingsFormResult {
  const { adminSettings, refreshAdminSettings, updateSettings: ctxUpdateSettings, isLoading } = useContext(SettingsContext);
  const [formData, setFormData] = useState<AppSettingsUpdate>(() => getInitialFormData(adminSettings));
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load admin settings on mount
  useEffect(() => {
    refreshAdminSettings();
  }, [refreshAdminSettings]);

  // Update form data when settings load
  useEffect(() => {
    setFormData(getInitialFormData(adminSettings));
  }, [adminSettings]);

  // Auto-dismiss "success" status
  useEffect(() => {
    if (saveStatus !== 'success') return;
    const timer = setTimeout(() => setSaveStatus('idle'), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  function handleFieldChange<K extends keyof AppSettingsUpdate>(
    field: K,
    value: AppSettingsUpdate[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }

  async function handleSave() {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      await ctxUpdateSettings(formData);
      setSaveStatus('success');
      setHasChanges(false);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings');
    }
  }

  async function handleReset() {
    if (!confirm('Reset all settings to defaults? This action cannot be undone.')) {
      return;
    }
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      await resetSettings();
      await refreshAdminSettings();
      setSaveStatus('success');
      setHasChanges(false);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reset settings');
    }
  }

  async function handleExport() {
    try {
      await downloadSettingsExport();
    } catch (error) {
      alert('Failed to export settings: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Import settings from file? This will overwrite current settings.')) {
      e.target.value = '';
      return;
    }

    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      await uploadSettingsImport(file);
      await refreshAdminSettings();
      setSaveStatus('success');
      setHasChanges(false);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import settings');
    }
    e.target.value = '';
  }

  return {
    formData,
    hasChanges,
    setHasChanges,
    handleFieldChange,
    saveStatus,
    errorMessage,
    isLoading,
    handleSave,
    handleReset,
    handleExport,
    handleImport,
  };
}