import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext.js';
import { getSystemInfo, getMigrations, getSystemHealth } from '../api/system.js';
import type { SystemInfo, MigrationsInfo, SystemHealth } from '../api/system.js';

interface SystemData {
  systemInfo: SystemInfo | null;
  migrations: MigrationsInfo | null;
  health: SystemHealth | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useSystemData(): SystemData {
  const { hasPermission } = useContext(AuthContext);
  const canViewInfo = hasPermission('system:info');
  const canViewHealth = hasPermission('system:health');
  const canViewMigrations = hasPermission('system:migrations');

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [migrations, setMigrations] = useState<MigrationsInfo | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [infoData, migrationsData, healthData] = await Promise.all([
        canViewInfo ? getSystemInfo() : Promise.resolve(null),
        canViewMigrations ? getMigrations() : Promise.resolve(null),
        canViewHealth ? getSystemHealth() : Promise.resolve(null),
      ]);
      setSystemInfo(infoData);
      setMigrations(migrationsData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system information');
    } finally {
      setIsLoading(false);
    }
  }, [canViewInfo, canViewHealth, canViewMigrations]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { systemInfo, migrations, health, isLoading, error, reload };
}

export function useAutoReload(active: boolean, reload: () => Promise<void>, intervalMs = 30000) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      void reload();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, reload, intervalMs]);
}