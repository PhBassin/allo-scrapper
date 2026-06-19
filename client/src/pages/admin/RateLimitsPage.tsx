import { useState } from 'react';
import { useRateLimits } from '../../hooks/useRateLimits.js';
import {
  RATE_LIMIT_FIELDS,
  displayValue,
  toStoredValue,
  type RateLimitFieldDef,
} from '../../utils/rateLimitsConfig.js';
import Button from '../../components/ui/Button.js';
import type { RateLimitConfig, RateLimitAuditLogEntry } from '../../api/rate-limits.js';

interface RateLimitInputProps {
  field: RateLimitFieldDef;
  formData: Partial<RateLimitConfig>;
  disabled: boolean;
  onChange: (field: keyof RateLimitConfig, value: number) => void;
}

function RateLimitInput({ field, formData, disabled, onChange }: RateLimitInputProps) {
  const [local, setLocal] = useState<string>(String(displayValue(field, formData)));

  const handleChange = (raw: string) => {
    setLocal(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      onChange(field.key, toStoredValue(field, num));
    }
  };

  return (
    <div>
      <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
      </label>
      <input
        type="number"
        id={field.key}
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        min={field.min}
        max={field.max}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
      <p className="mt-1 text-xs text-gray-400">
        Min: {field.min} | Max: {field.max}
      </p>
    </div>
  );
}

function ConfigurationInfo({ config }: { config: { source: string; environment: string; updatedAt: string | null; updatedBy: { username: string } | null } }) {
  const sourceClass =
    config.source === 'database'
      ? 'bg-green-100 text-green-800'
      : config.source === 'env'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Configuration Info</h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Source</dt>
          <dd className="mt-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sourceClass}`}>
              {config.source}
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Environment</dt>
          <dd className="mt-1 text-gray-900">{config.environment}</dd>
        </div>
        {config.updatedAt && (
          <>
            <div>
              <dt className="font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-gray-900">{new Date(config.updatedAt).toLocaleString()}</dd>
            </div>
            {config.updatedBy && (
              <div>
                <dt className="font-medium text-gray-500">Updated By</dt>
                <dd className="mt-1 text-gray-900">{config.updatedBy.username}</dd>
              </div>
            )}
          </>
        )}
      </dl>
    </div>
  );
}

function AuditLogTable({ logs }: { logs: RateLimitAuditLogEntry[] }) {
  if (logs.length === 0) {
    return <p className="text-gray-500 text-sm">No changes recorded yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Old Value</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Value</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                {new Date(log.changed_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {log.changed_by_username}
                <span className="ml-2 text-xs text-gray-500">({log.changed_by_role})</span>
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-900">{log.field_name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{log.old_value}</td>
              <td className="px-4 py-3 text-sm text-green-600 font-semibold">{log.new_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RateLimitsPage() {
  const {
    config,
    isLoading,
    formData,
    hasChanges,
    saveStatus,
    errorMessage,
    showAuditLog,
    auditLog,
    canUpdate,
    canReset,
    canViewAudit,
    handleChange,
    handleSave,
    handleReset,
    handleViewAuditLog,
    reload,
  } = useRateLimits();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading rate limit configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load rate limit configuration</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rate Limit Configuration</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage API rate limits to protect against abuse and ensure fair usage
          </p>
        </div>
        <div className="flex gap-2">
          {canViewAudit && (
            <Button variant="secondary" onClick={handleViewAuditLog}>
              {showAuditLog ? 'Hide Audit Log' : 'View Audit Log'}
            </Button>
          )}
          {canReset && (
            <Button variant="danger" onClick={handleReset} disabled={saveStatus === 'saving'}>
              Reset to Defaults
            </Button>
          )}
        </div>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          Rate limits updated successfully. Changes will take effect within 30 seconds.
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {errorMessage}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RATE_LIMIT_FIELDS.map((field) => (
            <RateLimitInput
              key={field.key}
              field={field}
              formData={formData}
              disabled={!canUpdate}
              onChange={handleChange}
            />
          ))}
        </div>

        {canUpdate && hasChanges && (
          <div className="flex justify-end gap-2 pt-6 mt-6 border-t">
            <Button variant="secondary" onClick={reload}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      <ConfigurationInfo config={config} />

      {showAuditLog && canViewAudit && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Recent Changes</h3>
          <AuditLogTable logs={auditLog} />
        </div>
      )}
    </div>
  );
}
