import React, { useState } from 'react';
import type { TheaterCreate } from '../../api/theaters';
import { SmartAddForm } from './theater-form/SmartAddForm.js';
import { ManualAddForm } from './theater-form/ManualAddForm.js';
import { useAddTheaterForm } from './theater-form/useAddTheaterForm.js';

interface AddTheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: TheaterCreate) => Promise<void>;
}

type Tab = 'smart' | 'manual';

const AddTheaterModal: React.FC<AddTheaterModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [activeTab, setActiveTab] = useState<Tab>('smart');
  const { isSubmitting } = useAddTheaterForm();

  if (!isOpen) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleClose() {
    if (isSubmitting) return;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="add-theater-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <ModalHeader onClose={handleClose} disabled={isSubmitting} />
        <Tabs activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'smart' ? (
          <SmartAddForm isSubmitting={isSubmitting} onSubmit={onAdd} onCancel={handleClose} />
        ) : (
          <ManualAddForm isSubmitting={isSubmitting} onSubmit={onAdd} onCancel={handleClose} />
        )}
      </div>
    </div>
  );
};

function ModalHeader({ onClose, disabled }: { onClose: () => void; disabled: boolean }) {
  return (
    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 className="text-xl font-semibold text-gray-900">Add Theater</h2>
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function Tabs({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="flex border-b border-gray-200">
      <TabButton id="smart" label="Smart Add (URL)" activeTab={activeTab} onChange={onChange} />
      <TabButton id="manual" label="Manual Add" activeTab={activeTab} onChange={onChange} />
    </div>
  );
}

function TabButton({
  id,
  label,
  activeTab,
  onChange,
}: {
  id: Tab;
  label: string;
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={`flex-1 px-4 py-2 text-sm font-medium transition ${
        activeTab === id
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

export default AddTheaterModal;