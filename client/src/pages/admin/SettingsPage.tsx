import React, { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { SettingsContext } from '../../contexts/SettingsContext';
import { type AppSettingsUpdate } from '../../api/settings';
import GeneralTab from '../../components/admin/GeneralTab';
import ColorsTab from '../../components/admin/ColorsTab';
import TypographyTab from '../../components/admin/TypographyTab';
import FooterTab from '../../components/admin/FooterTab';
import EmailTab from '../../components/admin/EmailTab';
import { SettingsTabs, type SettingsTabId, SETTINGS_TABS } from '../../components/admin/settings/SettingsTabs';
import { SettingsFooter } from '../../components/admin/settings/SettingsFooter';
import { useSettingsForm } from '../../hooks/useSettingsForm';

const TAB_COMPONENTS: Record<SettingsTabId, React.ComponentType<{
  value: AppSettingsUpdate;
  onChange: (field: string, value: unknown) => void;
  disabled: boolean;
}>> = {
  general: GeneralTab,
  colors: ColorsTab,
  typography: TypographyTab,
  footer: FooterTab,
  email: EmailTab,
};

const SettingsPage: React.FC = () => {
  const { adminSettings, isLoading: ctxIsLoading } = useContext(SettingsContext);
  const { hasPermission } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  const canUpdate = hasPermission('settings:update');
  const canReset = hasPermission('settings:reset');
  const canExport = hasPermission('settings:export');
  const canImport = hasPermission('settings:import');

  const form = useSettingsForm();

  if (!adminSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm">
          <PageHeader />
          <div className="border-b border-gray-200">
            <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div className="p-6">
            <ActiveTabComponent
              value={form.formData}
              onChange={(field, value) =>
                form.handleFieldChange(field as keyof AppSettingsUpdate, value as never)
              }
              disabled={!canUpdate}
            />
          </div>
          <SettingsFooter
            canExport={canExport}
            canImport={canImport}
            canReset={canReset}
            canUpdate={canUpdate}
            hasChanges={form.hasChanges}
            isLoading={ctxIsLoading || form.isLoading}
            saveStatus={form.saveStatus}
            errorMessage={form.errorMessage}
            onExport={form.handleExport}
            onImport={form.handleImport}
            onReset={form.handleReset}
            onSave={form.handleSave}
          />
        </div>
      </div>
    </div>
  );
};

function PageHeader() {
  return (
    <div className="border-b border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-gray-900">White-Label Settings</h1>
      <p className="mt-1 text-sm text-gray-600">
        Customize the branding and appearance of your application
      </p>
    </div>
  );
}

// Suppress unused warnings for tab list — kept exported so consumers/tests can iterate.
void SETTINGS_TABS;

export default SettingsPage;