import React, { useState } from 'react';
import DashboardTab from './DashboardTab';
import OrgsTab from './OrgsTab';
import AuditLogTab from './AuditLogTab';

type TabId = 'dashboard' | 'organisations' | 'audit-log';

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'organisations', label: 'Organisations' },
  { id: 'audit-log', label: 'Audit Log' },
];

const SuperadminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">Superadmin Portal</h1>
        <p className="text-gray-500 mt-1 text-sm">Global SaaS administration</p>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                pb-4 border-b-2 font-medium transition-colors cursor-pointer
                ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'organisations' && <OrgsTab />}
        {activeTab === 'audit-log' && <AuditLogTab />}
      </div>
    </div>
  );
};

export default SuperadminPage;
