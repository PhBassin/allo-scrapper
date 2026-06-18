import Button from '../../ui/Button';
import type { SaveStatus } from '../../../hooks/useSettingsForm';

interface SettingsFooterProps {
  canExport: boolean;
  canImport: boolean;
  canReset: boolean;
  canUpdate: boolean;
  hasChanges: boolean;
  isLoading: boolean;
  saveStatus: SaveStatus;
  errorMessage: string | null;
  onExport: () => Promise<void>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onReset: () => Promise<void>;
  onSave: () => Promise<void>;
}

export function SettingsFooter({
  canExport,
  canImport,
  canReset,
  canUpdate,
  hasChanges,
  isLoading,
  saveStatus,
  errorMessage,
  onExport,
  onImport,
  onReset,
  onSave,
}: SettingsFooterProps) {
  return (
    <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
      <div className="flex gap-2">
        {canExport && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onExport}
            disabled={isLoading}
            data-testid="export-settings-button"
          >
            Export
          </Button>
        )}
        {canImport && (
          <label
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
            data-testid="import-settings-button"
          >
            Import
            <input
              type="file"
              accept="application/json"
              onChange={onImport}
              className="hidden"
            />
          </label>
        )}
        {canReset && (
          <Button
            variant="danger"
            size="sm"
            onClick={onReset}
            disabled={isLoading}
            data-testid="reset-settings-button"
          >
            Reset to Defaults
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        {saveStatus === 'success' && (
          <p className="text-sm text-green-600">✓ Settings saved successfully</p>
        )}
        {canUpdate && (
          <Button
            onClick={onSave}
            disabled={!hasChanges || isLoading || saveStatus === 'saving'}
            data-testid="save-settings-button"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>
    </div>
  );
}