import React, { useState } from 'react';
import type { CinemaCreate } from '../../api/cinemas';

interface AddCinemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: CinemaCreate) => Promise<void>;
}

type Tab = 'smart' | 'manual';

const ALLOCINE_URL_PREFIX = 'https://www.allocine.fr/';
const ID_REGEX = /^[A-Za-z0-9]+$/;

function isAllocineUrl(url: string): boolean {
  return url.startsWith(ALLOCINE_URL_PREFIX);
}

interface SmartErrors {
  url?: string;
  submit?: string;
}

interface ManualErrors {
  id?: string;
  name?: string;
  url?: string;
  submit?: string;
}

const AddCinemaModal: React.FC<AddCinemaModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [activeTab, setActiveTab] = useState<Tab>('smart');

  // Smart Add state
  const [smartUrl, setSmartUrl] = useState('');
  const [smartErrors, setSmartErrors] = useState<SmartErrors>({});

  // Manual Add state
  const [manualId, setManualId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualErrors, setManualErrors] = useState<ManualErrors>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setActiveTab('smart');
    setSmartUrl('');
    setSmartErrors({});
    setManualId('');
    setManualName('');
    setManualUrl('');
    setManualErrors({});
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // ── Smart Add ──────────────────────────────────────────────────────────────

  const validateSmartUrl = (url: string): string | undefined => {
    if (!url.trim()) return 'URL is required';
    if (!isAllocineUrl(url)) return 'Must be an Allocine URL (https://www.allocine.fr/...)';
    if (url.length > 2048) return 'URL must be at most 2048 characters';
    return undefined;
  };

  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlError = validateSmartUrl(smartUrl);
    if (urlError) {
      setSmartErrors({ url: urlError });
      return;
    }
    setSmartErrors({});
    setIsSubmitting(true);
    try {
      await onAdd({ url: smartUrl });
      resetForm();
    } catch (err) {
      setSmartErrors({ submit: err instanceof Error ? err.message : 'Failed to add cinema' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Manual Add ─────────────────────────────────────────────────────────────

  const validateManual = (): ManualErrors => {
    const errors: ManualErrors = {};
    if (!manualId.trim()) {
      errors.id = 'ID is required';
    } else if (!ID_REGEX.test(manualId)) {
      errors.id = 'ID must be alphanumeric only';
    } else if (manualId.length > 20) {
      errors.id = 'ID must be at most 20 characters';
    }
    if (!manualName.trim()) {
      errors.name = 'Name is required';
    } else if (manualName.trim().length > 100) {
      errors.name = 'Name must be at most 100 characters';
    }
    if (!manualUrl.trim()) {
      errors.url = 'URL is required';
    } else if (!isAllocineUrl(manualUrl)) {
      errors.url = 'Must be an Allocine URL (https://www.allocine.fr/...)';
    } else if (manualUrl.length > 2048) {
      errors.url = 'URL must be at most 2048 characters';
    }
    return errors;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateManual();
    if (Object.keys(errors).length > 0) {
      setManualErrors(errors);
      return;
    }
    setManualErrors({});
    setIsSubmitting(true);
    try {
      await onAdd({ id: manualId, name: manualName.trim(), url: manualUrl });
      resetForm();
    } catch (err) {
      setManualErrors({ submit: err instanceof Error ? err.message : 'Failed to add cinema' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
      hasError ? 'border-red-500' : 'border-gray-300'
    }`;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="add-cinema-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Add Cinema</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('smart')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'smart'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Smart Add (URL)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'manual'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Manual Add
          </button>
        </div>

        {/* Smart Add Form */}
        {activeTab === 'smart' && (
          <form onSubmit={handleSmartSubmit} className="px-6 py-4">
            <p className="text-sm text-gray-500 mb-4">
              The cinema metadata and showtimes will be automatically scraped. This can take 30+ seconds.
            </p>
            <div className="mb-4">
              <label htmlFor="smart-url" className="block text-sm font-medium text-gray-700 mb-1">
                Allocine URL
              </label>
              <input
                id="smart-url"
                type="url"
                value={smartUrl}
                onChange={(e) => setSmartUrl(e.target.value)}
                disabled={isSubmitting}
                placeholder="https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"
                className={inputClass(!!smartErrors.url)}
              />
              {smartErrors.url && (
                <p className="mt-1 text-sm text-red-600">{smartErrors.url}</p>
              )}
            </div>
            {smartErrors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{smartErrors.submit}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add Cinema'}
              </button>
            </div>
          </form>
        )}

        {/* Manual Add Form */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="px-6 py-4">
            <div className="mb-4">
              <label htmlFor="manual-id" className="block text-sm font-medium text-gray-700 mb-1">
                Cinema ID
              </label>
              <input
                id="manual-id"
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. C0159"
                className={inputClass(!!manualErrors.id)}
              />
              {manualErrors.id && (
                <p className="mt-1 text-sm text-red-600">{manualErrors.id}</p>
              )}
            </div>
            <div className="mb-4">
              <label htmlFor="manual-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="manual-name"
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. UGC Ciné Cité Les Halles"
                className={inputClass(!!manualErrors.name)}
              />
              {manualErrors.name && (
                <p className="mt-1 text-sm text-red-600">{manualErrors.name}</p>
              )}
            </div>
            <div className="mb-4">
              <label htmlFor="manual-url" className="block text-sm font-medium text-gray-700 mb-1">
                Allocine URL
              </label>
              <input
                id="manual-url"
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                disabled={isSubmitting}
                placeholder="https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"
                className={inputClass(!!manualErrors.url)}
              />
              {manualErrors.url && (
                <p className="mt-1 text-sm text-red-600">{manualErrors.url}</p>
              )}
            </div>
            {manualErrors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{manualErrors.submit}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add Cinema'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddCinemaModal;
