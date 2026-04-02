import { useEffect, useState } from 'react';
import { getSuperadminAuditLog, type AuditLogEntry } from '../../api/superadmin';

export default function AuditLogTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    getSuperadminAuditLog({ page, limit })
      .then((res) => {
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (loading) return <p className="text-gray-500">Loading audit log...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Audit Log</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metadata</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">{entry.actor_id}</td>
                <td className="px-4 py-3 text-sm font-medium">{entry.action}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {entry.target_type ? `${entry.target_type}:${entry.target_id}` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                  {Object.keys(entry.metadata).length > 0
                    ? JSON.stringify(entry.metadata)
                    : '—'}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages} ({total} entries)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-sm px-3 py-1 border rounded disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-sm px-3 py-1 border rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
