import React, { useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CinemasPage from './CinemasPage';
import SettingsPage from './SettingsPage';
import UsersPage from './UsersPage';
import SystemPage from './SystemPage';
import ReportsPage from '../ReportsPage';
import RoleManagementPage from '../../components/admin/RoleManagementPage';
import { AuthContext } from '../../contexts/AuthContext';

type TabId = 'cinemas' | 'rapports' | 'users' | 'roles' | 'settings' | 'system';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  /** All listed permissions must be held for the tab to be visible */
  permissions?: string[];
}

const tabs: Tab[] = [
  {
    id: 'cinemas',
    label: 'Cinemas',
    // Cinemas tab is visible to anyone with at least one cinema/scraper permission
    permission: 'cinemas:create',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    id: 'rapports',
    label: 'Rapports',
    permission: 'reports:list',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    permission: 'users:list',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'roles',
    label: 'Roles',
    permission: 'roles:list',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    permission: 'settings:read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'System',
    permissions: ['system:info', 'system:health', 'system:migrations'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
];

const AdminPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useContext(AuthContext);
  const currentTab = searchParams.get('tab') || 'cinemas';

  // Filter tabs to only those the user has permission to see
  const visibleTabs = tabs.filter((tab) => {
    if (tab.permissions) {
      return tab.permissions.every((p) => hasPermission(p));
    }
    return !tab.permission || hasPermission(tab.permission);
  });
  const visibleTabIds = visibleTabs.map((t) => t.id);

  // Validate tab and fallback to first visible tab (or 'cinemas')
  const fallbackTab: TabId = visibleTabIds[0] ?? 'cinemas';
  const activeTab: TabId = visibleTabIds.includes(currentTab as TabId)
    ? (currentTab as TabId)
    : fallbackTab;

  // Redirect to fallback if URL points to a forbidden tab
  useEffect(() => {
    if (currentTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [currentTab, activeTab, setSearchParams]);

  const handleTabClick = (tabId: TabId) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">Administration</h1>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-gray-200 mb-6 sticky top-0 bg-white z-10">
        <nav className="flex space-x-8" role="tablist">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`
                flex items-center gap-2 pb-4 border-b-2 font-medium transition-colors cursor-pointer
                ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'cinemas' && <CinemasPage />}
        {activeTab === 'rapports' && <ReportsPage />}
        {activeTab === 'users' && <UsersPage />}
        {activeTab === 'roles' && <RoleManagementPage />}
        {activeTab === 'settings' && <SettingsPage />}
        {activeTab === 'system' && <SystemPage />}
      </div>
    </div>
  );
};

export default AdminPage;
