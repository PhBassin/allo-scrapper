import React, { useState, useEffect } from 'react';
import { getSystemInfo, getMigrations, getSystemHealth, formatUptime, formatDate } from '../../api/system';
import type { SystemInfo, MigrationsInfo, SystemHealth } from '../../api/system';

const SystemPage: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [migrations, setMigrations] = useState<MigrationsInfo | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [infoData, migrationsData, healthData] = await Promise.all([
        getSystemInfo(),
        getMigrations(),
        getSystemHealth(),
      ]);
      setSystemInfo(infoData);
      setMigrations(migrationsData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system information');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading && !systemInfo) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">System Information</h1>
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading system information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">System Information</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">System Information</h1>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Health Status Card */}
      {health && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Overall Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.status)}`}>
                {health.status.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Database</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${health.checks.database ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {health.checks.database ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Migrations</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${health.checks.migrations ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'}`}>
                {health.checks.migrations ? 'Up to date' : 'Pending'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Server Uptime</p>
                <p className="text-lg font-medium">{formatUptime(health.uptime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Scrape Jobs</p>
                <p className="text-lg font-medium">{health.scrapers.activeJobs}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Cinemas</p>
                <p className="text-lg font-medium">{health.scrapers.totalCinemas}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Info Grid */}
      {systemInfo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* App Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Application</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-600">Version</dt>
                <dd className="font-medium">{systemInfo.app.version}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Environment</dt>
                <dd className="font-medium capitalize">{systemInfo.app.environment}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Node Version</dt>
                <dd className="font-medium">{systemInfo.app.nodeVersion}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Build Date</dt>
                <dd className="font-medium text-sm">{systemInfo.app.buildDate.split('T')[0]}</dd>
              </div>
            </dl>
          </div>

          {/* Server Health Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Server</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-600">Platform</dt>
                <dd className="font-medium capitalize">{systemInfo.server.platform} ({systemInfo.server.arch})</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Uptime</dt>
                <dd className="font-medium">{formatUptime(systemInfo.server.uptime)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Heap Used</dt>
                <dd className="font-medium">{systemInfo.server.memoryUsage.heapUsed}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Heap Total</dt>
                <dd className="font-medium">{systemInfo.server.memoryUsage.heapTotal}</dd>
              </div>
            </dl>
          </div>

          {/* Database Stats Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Database</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-600">Size</dt>
                <dd className="font-medium">{systemInfo.database.size}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Tables</dt>
                <dd className="font-medium">{systemInfo.database.tables}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Cinemas</dt>
                <dd className="font-medium">{systemInfo.database.cinemas}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Films</dt>
                <dd className="font-medium">{systemInfo.database.films}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Seances</dt>
                <dd className="font-medium">{systemInfo.database.seances}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Migrations Table */}
      {migrations && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Database Migrations ({migrations.total} total)
          </h2>
          
          {migrations.pending.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 font-medium">
                ⚠️ {migrations.pending.length} pending migration(s) detected
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Run database migrations to apply pending changes
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {migrations.applied.map((migration) => (
                  <tr key={migration.version}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {migration.version}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Applied
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(migration.appliedAt)}
                    </td>
                  </tr>
                ))}
                {migrations.pending.map((migration) => (
                  <tr key={migration.version} className="bg-yellow-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {migration.version}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      —
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemPage;
