import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext.js';
import {
  getRateLimits,
  updateRateLimits,
  resetRateLimits,
  getRateLimitAuditLog,
  type RateLimitConfigResponse,
  type RateLimitConfig,
  type RateLimitAuditLogEntry,
} from '../api/rate-limits.js';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface UseRateLimitsResult {
  config: RateLimitConfigResponse | null;
  isLoading: boolean;
  formData: Partial<RateLimitConfig>;
  hasChanges: boolean;
  saveStatus: SaveStatus;
  errorMessage: string | null;
  showAuditLog: boolean;
  auditLog: RateLimitAuditLogEntry[];
  canUpdate: boolean;
  canReset: boolean;
  canViewAudit: boolean;
  handleChange: (field: keyof RateLimitConfig, value: number) => void;
  handleSave: () => Promise<void>;
  handleReset: () => Promise<void>;
  handleViewAuditLog: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useRateLimits(): UseRateLimitsResult {
  const { hasPermission } = useContext(AuthContext);
  const [config, setConfig] = useState<RateLimitConfigResponse | null>(null);
  const [formData, setFormData] = useState<Partial<RateLimitConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLog, setAuditLog] = useState<RateLimitAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getRateLimits();
      setConfig(data);
      setFormData(data.config);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load rate limit configuration'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applyResponse = (updated: RateLimitConfigResponse) => {
    setConfig(updated);
    setFormData(updated.config);
    setHasChanges(false);
    setSaveStatus('success');
    window.setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleChange = (field: keyof RateLimitConfig, value: number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveStatus('idle');
    setErrorMessage(null);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      applyResponse(await updateRateLimits(formData));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to update rate limits'
      );
      setSaveStatus('error');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all rate limits to default values? This action cannot be undone.')) {
      return;
    }
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      applyResponse(await resetRateLimits());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to reset rate limits'
      );
      setSaveStatus('error');
    }
  };

  const handleViewAuditLog = async () => {
    if (showAuditLog) {
      setShowAuditLog(false);
      return;
    }
    try {
      const logs = await getRateLimitAuditLog({ limit: 50, offset: 0 });
      setAuditLog(logs.logs);
      setShowAuditLog(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load audit log'
      );
    }
  };

  return {
    config,
    isLoading,
    formData,
    hasChanges,
    saveStatus,
    errorMessage,
    showAuditLog,
    auditLog,
    canUpdate: hasPermission('ratelimits:update'),
    canReset: hasPermission('ratelimits:reset'),
    canViewAudit: hasPermission('ratelimits:audit'),
    handleChange,
    handleSave,
    handleReset,
    handleViewAuditLog,
    reload,
  };
}
