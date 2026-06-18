export const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'footer', label: 'Footer' },
  { id: 'email', label: 'Email' },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onChange: (tab: SettingsTabId) => void;
}

export function SettingsTabs({ activeTab, onChange }: SettingsTabsProps) {
  return (
    <nav className="flex space-x-8 px-6" aria-label="Tabs">
      {SETTINGS_TABS.map((tab) => (
        <TabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        />
      ))}
    </nav>
  );
}

interface TabButtonProps {
  id: SettingsTabId;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        py-4 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer
        ${active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
      `}
    >
      {label}
    </button>
  );
}