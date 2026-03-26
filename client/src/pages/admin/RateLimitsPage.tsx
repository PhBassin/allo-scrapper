import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import {
  getRateLimits,
  updateRateLimits,
  resetRateLimits,
  getRateLimitAuditLog,
  type RateLimitConfig,
  type RateLimitConfigResponse,
  type RateLimitAuditLogEntry,
} from '../../api/rate-limits';
import Button from '../../components/ui/Button';

const RateLimitsPage: React.FC = () => {
  const { hasPermission } = useContext(AuthContext);
  const [config, setConfig] = useState<RateLimitConfigResponse | null>(null);
  const [formData, setFormData] = useState<Partial<RateLimitConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLog, setAuditLog] = useState<RateLimitAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canUpdate = hasPermission('ratelimits:update');
  const canReset = hasPermission('ratelimits:reset');
  const canViewAudit = hasPermission('ratelimits:audit');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const data = await getRateLimits();
      setConfig(data);
      setFormData(data.config);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load rate limit configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof RateLimitConfig, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveStatus('idle');
    setErrorMessage(null);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const updated = await updateRateLimits(formData);
      setConfig(updated);
      setFormData(updated.config);
      setHasChanges(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update rate limits');
      setSaveStatus('error');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all rate limits to default values? This action cannot be undone.')) return;
    
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const reset = await resetRateLimits();
      setConfig(reset);
      setFormData(reset.config);
      setHasChanges(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reset rate limits');
      setSaveStatus('error');
    }
  };

  const handleViewAuditLog = async () => {
    if (!showAuditLog) {
      try {
        const logs = await getRateLimitAuditLog({ limit: 50, offset: 0 });
        setAuditLog(logs.logs);
        setShowAuditLog(true);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load audit log');
      }
    } else {
      setShowAuditLog(false);
    }
  };

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
      {/* Header */}
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

      {/* Status Messages */}
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

      {/* Configuration Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Global Window */}
          <RateLimitInput
            label="Global Window (minutes)"
            field="windowMs"
            value={Math.round((formData.windowMs || 900000) / 60000)}
            onChange={(v) => handleChange('windowMs', v * 60000)}
            min={1}
            max={60}
            disabled={!canUpdate}
            description="Default time window for most rate limiters"
          />

          {/* General API */}
          <RateLimitInput
            label="General API Limit"
            field="generalMax"
            value={formData.generalMax || 100}
            onChange={(v) => handleChange('generalMax', v)}
            min={10}
            max={1000}
            disabled={!canUpdate}
            description="Max requests per window for general API endpoints"
          />

          {/* Auth */}
          <RateLimitInput
            label="Login Limit"
            field="authMax"
            value={formData.authMax || 5}
            onChange={(v) => handleChange('authMax', v)}
            min={3}
            max={50}
            disabled={!canUpdate}
            description="Max login attempts per window (failed only)"
          />

          {/* Register */}
          <RateLimitInput
            label="Registration Limit"
            field="registerMax"
            value={formData.registerMax || 3}
            onChange={(v) => handleChange('registerMax', v)}
            min={1}
            max={20}
            disabled={!canUpdate}
            description="Max registration attempts per hour"
          />

          {/* Protected */}
          <RateLimitInput
            label="Protected Endpoints Limit"
            field="protectedMax"
            value={formData.protectedMax || 60}
            onChange={(v) => handleChange('protectedMax', v)}
            min={10}
            max={500}
            disabled={!canUpdate}
            description="Max requests per window for authenticated endpoints"
          />

          {/* Scraper */}
          <RateLimitInput
            label="Scraper Limit"
            field="scraperMax"
            value={formData.scraperMax || 10}
            onChange={(v) => handleChange('scraperMax', v)}
            min={5}
            max={100}
            disabled={!canUpdate}
            description="Max scrape requests per window (expensive operations)"
          />

          {/* Public */}
          <RateLimitInput
            label="Public Endpoints Limit"
            field="publicMax"
            value={formData.publicMax || 100}
            onChange={(v) => handleChange('publicMax', v)}
            min={20}
            max={1000}
            disabled={!canUpdate}
            description="Max requests per window for public read endpoints"
          />

          {/* Health Check */}
          <RateLimitInput
            label="Health Check Limit"
            field="healthMax"
            value={formData.healthMax || 10}
            onChange={(v) => handleChange('healthMax', v)}
            min={5}
            max={100}
            disabled={!canUpdate}
            description="Max health check requests per minute (localhost exempt)"
          />
        </div>

        {/* Save Button */}
        {canUpdate && hasChanges && (
          <div className="flex justify-end gap-2 pt-6 mt-6 border-t">
            <Button variant="secondary" onClick={fetchConfig}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* Configuration Info */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Configuration Info</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Source</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                config.source === 'database' ? 'bg-green-100 text-green-800' :
                config.source === 'env' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
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

      {/* Audit Log */}
      {showAuditLog && canViewAudit && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Recent Changes</h3>
          {auditLog.length === 0 ? (
            <p className="text-gray-500 text-sm">No changes recorded yet.</p>
          ) : (
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
                  {auditLog.map((log) => (
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
          )}
        </div>
      )}
    </div>
  );
};

interface RateLimitInputProps {
  label: string;
  field: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled: boolean;
  description?: string;
}

const RateLimitInput: React.FC<RateLimitInputProps> = ({
  label,
  field,
  value,
  onChange,
  min,
  max,
  disabled,
  description,
}) => {
  return (
    <div>
      <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="number"
        id={field}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        min={min}
        max={max}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      {description && (
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      )}
      <p className="mt-1 text-xs text-gray-400">
        Min: {min} | Max: {max}
      </p>
    </div>
  );
};

export default RateLimitsPage;
