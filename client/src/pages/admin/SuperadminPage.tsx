/**
 * Superadmin portal page with Dashboard, Organizations, and Audit Log tabs.
 */
import { useState, useEffect } from 'react';
import apiClient from '../../api/client';

interface DashboardMetrics {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  newOrgsThisWeek: number;
  orgsByPlan: { plan_name: string; count: number }[];
}

interface Organization {
  id: number;
  name: string;
  slug: string;
  status: string;
  plan_name: string;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

type Tab = 'dashboard' | 'orgs' | 'audit';

export default function SuperadminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'orgs') {
      loadOrgs();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/superadmin/dashboard');
      setMetrics(response.data.data);
    } catch (err) {
      setError('Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/superadmin/orgs?page=1&pageSize=50');
      setOrgs(response.data.data.orgs);
    } catch (err) {
      setError('Failed to load organizations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/superadmin/audit-log?page=1&pageSize=50');
      setAuditLogs(response.data.data.logs);
    } catch (err) {
      setError('Failed to load audit log');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (orgId: number) => {
    if (!confirm('Are you sure you want to suspend this organization?')) return;
    try {
      await apiClient.post(`/superadmin/orgs/${orgId}/suspend`);
      loadOrgs();
    } catch (err) {
      alert('Failed to suspend organization');
      console.error(err);
    }
  };

  const handleReactivate = async (orgId: number) => {
    try {
      await apiClient.post(`/superadmin/orgs/${orgId}/reactivate`);
      loadOrgs();
    } catch (err) {
      alert('Failed to reactivate organization');
      console.error(err);
    }
  };

  const handleImpersonate = async (orgSlug: string) => {
    try {
      const response = await apiClient.post('/superadmin/impersonate', { org_slug: orgSlug });
      const { token, org } = response.data.data;
      localStorage.setItem('token', token);
      window.location.href = `/org/${org.slug}/`;
    } catch (err) {
      alert('Failed to impersonate organization');
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/superadmin/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Superadmin Portal</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(['dashboard', 'orgs', 'audit'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'dashboard' && 'Dashboard'}
                {tab === 'orgs' && 'Organizations'}
                {tab === 'audit' && 'Audit Log'}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {loading && <div className="text-center py-8">Loading...</div>}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && metrics && !loading && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm text-gray-600">Total Orgs</div>
                  <div className="text-3xl font-bold text-gray-900">{metrics.totalOrgs}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm text-gray-600">Active</div>
                  <div className="text-3xl font-bold text-green-600">{metrics.activeOrgs}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm text-gray-600">Suspended</div>
                  <div className="text-3xl font-bold text-red-600">{metrics.suspendedOrgs}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm text-gray-600">New (7d)</div>
                  <div className="text-3xl font-bold text-blue-600">{metrics.newOrgsThisWeek}</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Orgs by Plan</h3>
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium text-gray-700">Plan</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-700">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.orgsByPlan.map((plan) => (
                      <tr key={plan.plan_name} className="border-b">
                        <td className="py-2 text-sm">{plan.plan_name}</td>
                        <td className="py-2 text-sm">{plan.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Organizations Tab */}
          {activeTab === 'orgs' && !loading && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{org.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{org.slug}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          org.status === 'active' ? 'bg-green-100 text-green-800' :
                          org.status === 'suspended' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{org.plan_name}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        {org.status !== 'suspended' && (
                          <button
                            onClick={() => handleSuspend(org.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Suspend
                          </button>
                        )}
                        {org.status === 'suspended' && (
                          <button
                            onClick={() => handleReactivate(org.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleImpersonate(org.slug)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          Impersonate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && !loading && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.action}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.target_type} #{log.target_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
