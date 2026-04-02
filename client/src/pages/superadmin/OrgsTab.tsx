import { useEffect, useState } from 'react';
import {
  getSuperadminOrgs,
  impersonateOrg,
  suspendOrg,
  reactivateOrg,
  resetOrgTrial,
  type OrgRow,
} from '../../api/superadmin';

export default function OrgsTab() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getSuperadminOrgs()
      .then(setOrgs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load orgs'))
      .finally(() => setLoading(false));
  }, []);

  const handleImpersonate = async (org: OrgRow) => {
    try {
      setActionError(null);
      const { token } = await impersonateOrg(org.slug);
      // Store impersonation token and navigate to org slug
      localStorage.setItem('impersonation_token', token);
      window.location.href = `/org/${org.slug}/`;
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Impersonation failed');
    }
  };

  const handleSuspend = async (org: OrgRow) => {
    try {
      setActionError(null);
      const updated = await suspendOrg(org.id);
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, ...updated } : o)));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Suspend failed');
    }
  };

  const handleReactivate = async (org: OrgRow) => {
    try {
      setActionError(null);
      const updated = await reactivateOrg(org.id);
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, ...updated } : o)));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Reactivate failed');
    }
  };

  const handleResetTrial = async (org: OrgRow) => {
    try {
      setActionError(null);
      const updated = await resetOrgTrial(org.id);
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, ...updated } : o)));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Reset trial failed');
    }
  };

  if (loading) return <p className="text-gray-500">Loading organisations...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Organisations</h2>
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {actionError}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial ends</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {orgs.map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-3 font-medium">{org.name}</td>
                <td className="px-4 py-3 text-gray-600">{org.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      org.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : org.status === 'trial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {org.status}
                  </span>
                </td>
                <td className="px-4 py-3">{org.plan_name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleImpersonate(org)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition"
                    aria-label={`Impersonate ${org.name}`}
                  >
                    Impersonate
                  </button>
                  <button
                    onClick={() => handleResetTrial(org)}
                    className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 transition"
                    aria-label={`Reset trial for ${org.name}`}
                  >
                    Reset Trial
                  </button>
                  {org.status !== 'suspended' ? (
                    <button
                      onClick={() => handleSuspend(org)}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition"
                      aria-label={`Suspend ${org.name}`}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(org)}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition"
                      aria-label={`Reactivate ${org.name}`}
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No organisations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
