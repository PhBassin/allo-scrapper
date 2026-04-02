import { useEffect, useState } from 'react';
import {
  getSuperadminDashboard,
  type SuperadminDashboardData,
} from '../../api/superadmin';

export default function DashboardTab() {
  const [data, setData] = useState<SuperadminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSuperadminDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  const mrrEuros = (data.mrr_cents / 100).toFixed(2);
  const arrEuros = (data.arr_cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(data.orgs).map(([status, count]) => (
          <div key={status} className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 capitalize">{status}</p>
            <p className="text-3xl font-bold">{count}</p>
          </div>
        ))}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">New this week</p>
          <p className="text-3xl font-bold">{data.new_orgs_this_week}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">MRR</p>
          <p className="text-2xl font-bold">€{mrrEuros}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">ARR</p>
          <p className="text-2xl font-bold">€{arrEuros}</p>
        </div>
      </div>
    </div>
  );
}
