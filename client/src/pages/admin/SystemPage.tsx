import React, { useState } from 'react';
import Button from '../../components/ui/Button.js';
import { useSystemData, useAutoReload } from '../../hooks/useSystemData.js';
import { formatUptime, formatDate } from '../../api/system.js';
import { getStatusColor, formatBuildDate } from '../../utils/system.js';

const SystemPage: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const data = useSystemData();
  useAutoReload(autoRefresh, data.reload);

  if (data.isLoading && !data.systemInfo) return <LoadingView />;
  if (data.error) return <ErrorView message={data.error} onRetry={data.reload} />;

  return (
    <div className="p-6">
      <Header
        isRefreshing={data.isLoading}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onRefresh={data.reload}
      />
      {data.health && <HealthCard health={data.health} />}
      {data.systemInfo && <SystemInfoGrid info={data.systemInfo} />}
      {data.migrations && <MigrationsTable migrations={data.migrations} />}
    </div>
  );
};

interface HeaderProps {
  isRefreshing: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
}

function Header({ isRefreshing, autoRefresh, onToggleAutoRefresh, onRefresh }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">System Information</h1>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={onToggleAutoRefresh}
            className="rounded"
          />
          Auto-refresh (30s)
        </label>
        <Button onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}

interface HealthCardProps {
  health: NonNullable<ReturnType<typeof useSystemData>['health']>;
}

function HealthCard({ health }: HealthCardProps) {
  return (
    <div className="mb-6 bg-white rounded-lg shadow p-6" data-testid="health-status-card">
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
          <Stat label="Server Uptime" value={formatUptime(health.uptime)} />
          <Stat label="Active Scrape Jobs" value={String(health.scrapers.activeJobs)} />
          <Stat label="Total Theaters" value={String(health.scrapers.totalTheaters)} />
        </div>
      </div>
    </div>
  );
}

interface SystemInfoGridProps {
  info: NonNullable<ReturnType<typeof useSystemData>['systemInfo']>;
}

function SystemInfoGrid({ info }: SystemInfoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" data-testid="system-info-grid">
      <AppInfoCard info={info.app} />
      <ServerInfoCard info={info.server} />
      <DatabaseInfoCard info={info.database} />
    </div>
  );
}

function AppInfoCard({ info }: { info: NonNullable<ReturnType<typeof useSystemData>['systemInfo']>['app'] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Application</h2>
      <dl className="space-y-2">
        <Row label="Version" value={info.version} />
        <Row label="Environment" value={<span className="capitalize">{info.environment}</span>} />
        <Row label="Node Version" value={info.nodeVersion} />
        <Row label="Build Date" value={formatBuildDate(info.buildDate)} small />
      </dl>
    </div>
  );
}

function ServerInfoCard({ info }: { info: NonNullable<ReturnType<typeof useSystemData>['systemInfo']>['server'] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Server</h2>
      <dl className="space-y-2">
        <Row label="Platform" value={<span className="capitalize">{info.platform} ({info.arch})</span>} />
        <Row label="Uptime" value={formatUptime(info.uptime)} />
        <Row label="Heap Used" value={info.memoryUsage.heapUsed} />
        <Row label="Heap Total" value={info.memoryUsage.heapTotal} />
      </dl>
    </div>
  );
}

function DatabaseInfoCard({ info }: { info: NonNullable<ReturnType<typeof useSystemData>['systemInfo']>['database'] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Database</h2>
      <dl className="space-y-2">
        <Row label="Size" value={info.size} />
        <Row label="Tables" value={String(info.tables)} />
        <Row label="Theaters" value={String(info.theaters)} />
        <Row label="Films" value={String(info.movies)} />
        <Row label="Showtimes" value={String(info.showtimes)} />
      </dl>
    </div>
  );
}

interface MigrationsTableProps {
  migrations: NonNullable<ReturnType<typeof useSystemData>['migrations']>;
}

function MigrationsTable({ migrations }: MigrationsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="migrations-table">
      <h2 className="text-lg font-semibold mb-4">
        Database Migrations ({migrations.total} total)
      </h2>
      {migrations.pending.length > 0 && <PendingNotice count={migrations.pending.length} />}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied At</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {migrations.applied.map((migration) => (
              <tr key={migration.version}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{migration.version}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Applied</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(migration.appliedAt)}</td>
              </tr>
            ))}
            {migrations.pending.map((migration) => (
              <tr key={migration.version} className="bg-yellow-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{migration.version}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingNotice({ count }: { count: number }) {
  return (
    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
      <p className="text-yellow-800 font-medium">⚠️ {count} pending migration(s) detected</p>
      <p className="text-sm text-yellow-700 mt-1">Run database migrations to apply pending changes</p>
    </div>
  );
}

function Row({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className={`font-medium ${small ? 'text-sm' : ''}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  );
}

function LoadingView() {
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

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">System Information</h1>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{message}</p>
        <Button variant="danger" onClick={onRetry} className="mt-4">
          Retry
        </Button>
      </div>
    </div>
  );
}

export default SystemPage;