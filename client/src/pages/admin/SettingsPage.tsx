import React, { useState, useContext } from 'react';
import { SettingsContext } from '../../contexts/SettingsContext';
import { AuthContext } from '../../contexts/AuthContext';
import { downloadSettingsExport, uploadSettingsImport, resetSettings, type AppSettings, type AppSettingsUpdate } from '../../api/settings';
import GeneralTab from '../../components/admin/GeneralTab';
import ColorsTab from '../../components/admin/ColorsTab';
import TypographyTab from '../../components/admin/TypographyTab';
import FooterTab from '../../components/admin/FooterTab';
import EmailTab from '../../components/admin/EmailTab';
import Button from '../../components/ui/Button';

type Tab = 'general' | 'colors' | 'typography' | 'footer' | 'email';

const getInitialFormData = (settings: AppSettings | null): AppSettingsUpdate => {
    if (!settings) return {};
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
        email_from_name: settings.email_from_name,
        email_from_address: settings.email_from_address,
        email_logo_base64: settings.email_logo_base64,
    };
};

const SettingsPage: React.FC = () => {
    const { adminSettings, refreshAdminSettings, updateSettings, isLoading } = useContext(SettingsContext);
    const { hasPermission } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [hasChanges, setHasChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Permission checks
    const canUpdate = hasPermission('settings:update');
    const canReset = hasPermission('settings:reset');
    const canExport = hasPermission('settings:export');
    const canImport = hasPermission('settings:import');

    // Form state
    const [formData, setFormData] = useState<AppSettingsUpdate>(() => getInitialFormData(adminSettings));

    // Load admin settings on mount
    React.useEffect(() => {
        refreshAdminSettings();
    }, [refreshAdminSettings]);

    // Update form data when settings load
    React.useEffect(() => {
        setFormData(getInitialFormData(adminSettings));
    }, [adminSettings]);

    const handleFieldChange = <K extends keyof AppSettingsUpdate>(
        field: K,
        value: AppSettingsUpdate[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        setErrorMessage(null);
        try {
            await updateSettings(formData);
            setSaveStatus('success');
            setHasChanges(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            setSaveStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings');
        }
    };

    const handleReset = async () => {
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
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            setSaveStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to reset settings');
        }
    };

    const handleExport = async () => {
        try {
            await downloadSettingsExport();
        } catch (error) {
            alert('Failed to export settings: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            setSaveStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to import settings');
        }
        e.target.value = ''; // Reset file input
    };

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

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-white rounded-lg shadow-sm">
                    {/* Header */}
                    <div className="border-b border-gray-200 p-6">
                        <h1 className="text-2xl font-bold text-gray-900">White-Label Settings</h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Customize the branding and appearance of your application
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6" aria-label="Tabs">
                            {([
                                { id: 'general', label: 'General' },
                                { id: 'colors', label: 'Colors' },
                                { id: 'typography', label: 'Typography' },
                                { id: 'footer', label: 'Footer' },
                                { id: 'email', label: 'Email' },
                            ] as const).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        py-4 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer
                                        ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }
                                    `}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab content */}
                    <div className="p-6">
                        {activeTab === 'general' && (
                            <GeneralTab
                                value={formData}
                                onChange={(field, value) => handleFieldChange(field as keyof AppSettingsUpdate, value)}
                                disabled={!canUpdate}
                            />
                        )}

                        {activeTab === 'colors' && (
                            <ColorsTab
                                value={formData}
                                onChange={(field, value) => handleFieldChange(field as keyof AppSettingsUpdate, value)}
                                disabled={!canUpdate}
                            />
                        )}

                        {activeTab === 'typography' && (
                            <TypographyTab
                                value={formData}
                                onChange={(field, value) => handleFieldChange(field as keyof AppSettingsUpdate, value)}
                                disabled={!canUpdate}
                            />
                        )}

                        {activeTab === 'footer' && (
                            <FooterTab
                                value={formData}
                                onChange={(field, value) => handleFieldChange(field as keyof AppSettingsUpdate, value)}
                                disabled={!canUpdate}
                            />
                        )}

                        {activeTab === 'email' && (
                            <EmailTab
                                value={formData}
                                onChange={(field, value) => handleFieldChange(field as keyof AppSettingsUpdate, value)}
                                disabled={!canUpdate}
                            />
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
                        <div className="flex gap-2">
                            {canExport && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={isLoading}
                                    data-testid="export-settings-button"
                                >
                                    Export
                                </Button>
                            )}
                            {canImport && (
                                <label className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer" data-testid="import-settings-button">
                                    Import
                                    <input
                                        type="file"
                                        accept="application/json"
                                        onChange={handleImport}
                                        className="hidden"
                                    />
                                </label>
                            )}
                            {canReset && (
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={handleReset}
                                    disabled={isLoading}
                                    data-testid="reset-settings-button"
                                >
                                    Reset to Defaults
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            {errorMessage && (
                                <p className="text-sm text-red-600">{errorMessage}</p>
                            )}
                            {saveStatus === 'success' && (
                                <p className="text-sm text-green-600">✓ Settings saved successfully</p>
                            )}
                            {canUpdate && (
                                <Button
                                    onClick={handleSave}
                                    disabled={!hasChanges || isLoading || saveStatus === 'saving'}
                                    data-testid="save-settings-button"
                                >
                                    {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
