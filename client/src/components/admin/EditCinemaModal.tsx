import React, { useState } from 'react';
import type { Cinema } from '../../types';
import type { CinemaUpdate } from '../../api/cinemas';

/**
 * Modal for editing a cinema's name and URL.
 *
 * IMPORTANT: The parent must supply `key={cinema.id}` when rendering this
 * component so React remounts it whenever the selected cinema changes.
 * Without this, useState initial values are only applied on first mount,
 * causing stale data when switching between cinemas without closing:
 *
 *   {cinemaToEdit && (
 *     <EditCinemaModal
 *       key={cinemaToEdit.id}
 *       isOpen={true}
 *       cinema={cinemaToEdit}
 *       onClose={() => setCinemaToEdit(null)}
 *       onSave={handleUpdateCinema}
 *     />
 *   )}
 */

interface EditCinemaModalProps {
  isOpen: boolean;
  cinema: Cinema;
  onClose: () => void;
  onSave: (id: string, updates: CinemaUpdate) => Promise<void>;
}

const ALLOCINE_URL_PREFIX = 'https://www.allocine.fr/';

function isAllocineUrl(url: string): boolean {
  return url.startsWith(ALLOCINE_URL_PREFIX);
}

const EditCinemaModal: React.FC<EditCinemaModalProps> = ({ isOpen, cinema, onClose, onSave }) => {
  const [name, setName] = useState(cinema.name);
  const [url, setUrl] = useState(cinema.url ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [urlError, setUrlError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const hasChanges =
    name.trim() !== cinema.name.trim() || url.trim() !== (cinema.url ?? '').trim();

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length > 100) return 'Name must be at most 100 characters';
    return undefined;
  };

  const validateUrl = (value: string): string | undefined => {
    if (!value.trim()) return undefined; // URL is optional
    if (!isAllocineUrl(value)) return 'Must be an Allocine URL (https://www.allocine.fr/...)';
    if (value.length > 2048) return 'URL must be at most 2048 characters';
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nErr = validateName(name);
    const uErr = validateUrl(url);
    setNameError(nErr);
    setUrlError(uErr);
    if (nErr || uErr) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const updates: CinemaUpdate = {};
      if (name.trim() !== cinema.name.trim()) updates.name = name.trim();
      if (url.trim() !== (cinema.url ?? '').trim()) updates.url = url.trim() || undefined;
      await onSave(cinema.id, updates);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save cinema');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
      hasError ? 'border-red-500' : 'border-gray-300'
    }`;

  const screenCountDisplay =
    cinema.screen_count != null ? cinema.screen_count : '-';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="edit-cinema-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Edit Cinema</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Read-only info */}
        <div className="px-6 pt-4 pb-2 bg-gray-50 border-b border-gray-200">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500 font-medium">ID</dt>
            <dd className="font-mono text-gray-900">{cinema.id}</dd>
            <dt className="text-gray-500 font-medium">Address</dt>
            <dd className="text-gray-900">{cinema.address ?? '-'}</dd>
            <dt className="text-gray-500 font-medium">City</dt>
            <dd className="text-gray-900">{cinema.city ?? '-'}</dd>
            <dt className="text-gray-500 font-medium">Screens</dt>
            <dd className="text-gray-900">{screenCountDisplay}</dd>
          </dl>
        </div>

        {/* Editable form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="mb-4">
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              className={inputClass(!!nameError)}
            />
            {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="edit-url" className="block text-sm font-medium text-gray-700 mb-1">
              Allocine URL <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSaving}
              placeholder="https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"
              className={inputClass(!!urlError)}
            />
            {urlError && <p className="mt-1 text-sm text-red-600">{urlError}</p>}
          </div>

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCinemaModal;
