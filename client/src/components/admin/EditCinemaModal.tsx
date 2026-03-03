import React, { useState } from 'react';
import type { Cinema } from '../../types';
import type { CinemaUpdate } from '../../api/cinemas';

/**
 * Modal for editing a cinema's information.
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
  const [address, setAddress] = useState(cinema.address ?? '');
  const [postalCode, setPostalCode] = useState(cinema.postal_code ?? '');
  const [city, setCity] = useState(cinema.city ?? '');
  const [screenCount, setScreenCount] = useState<string>(
    cinema.screen_count != null ? String(cinema.screen_count) : ''
  );

  const [nameError, setNameError] = useState<string | undefined>();
  const [urlError, setUrlError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();
  const [postalCodeError, setPostalCodeError] = useState<string | undefined>();
  const [cityError, setCityError] = useState<string | undefined>();
  const [screenCountError, setScreenCountError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const hasChanges =
    name.trim() !== cinema.name.trim() ||
    url.trim() !== (cinema.url ?? '').trim() ||
    address.trim() !== (cinema.address ?? '').trim() ||
    postalCode.trim() !== (cinema.postal_code ?? '').trim() ||
    city.trim() !== (cinema.city ?? '').trim() ||
    screenCount.trim() !== (cinema.screen_count != null ? String(cinema.screen_count) : '');

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

  const validateAddress = (value: string): string | undefined => {
    if (value.trim() && value.length > 200) return 'Address must be at most 200 characters';
    return undefined;
  };

  const validatePostalCode = (value: string): string | undefined => {
    if (value.trim()) {
      if (value.length > 10) return 'Postal code must be at most 10 characters';
      if (!/^[a-zA-Z0-9]+$/.test(value)) return 'Postal code must be alphanumeric';
    }
    return undefined;
  };

  const validateCity = (value: string): string | undefined => {
    if (value.trim() && value.length > 100) return 'City must be at most 100 characters';
    return undefined;
  };

  const validateScreenCount = (value: string): string | undefined => {
    if (value.trim()) {
      const num = Number(value);
      if (isNaN(num)) return 'Screen count must be a number';
      if (!Number.isInteger(num)) return 'Screen count must be an integer';
      if (num < 1 || num > 50) return 'Screen count must be between 1 and 50';
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const nErr = validateName(name);
    const uErr = validateUrl(url);
    const aErr = validateAddress(address);
    const pErr = validatePostalCode(postalCode);
    const cErr = validateCity(city);
    const scErr = validateScreenCount(screenCount);

    setNameError(nErr);
    setUrlError(uErr);
    setAddressError(aErr);
    setPostalCodeError(pErr);
    setCityError(cErr);
    setScreenCountError(scErr);

    if (nErr || uErr || aErr || pErr || cErr || scErr) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const updates: CinemaUpdate = {};

      if (name.trim() !== cinema.name.trim()) updates.name = name.trim();
      if (url.trim() !== (cinema.url ?? '').trim()) updates.url = url.trim() || undefined;
      if (address.trim() !== (cinema.address ?? '').trim()) updates.address = address.trim() || undefined;
      if (postalCode.trim() !== (cinema.postal_code ?? '').trim())
        updates.postal_code = postalCode.trim() || undefined;
      if (city.trim() !== (cinema.city ?? '').trim()) updates.city = city.trim() || undefined;

      const currentScreenCount = cinema.screen_count != null ? String(cinema.screen_count) : '';
      if (screenCount.trim() !== currentScreenCount) {
        updates.screen_count = screenCount.trim() ? Number(screenCount.trim()) : undefined;
      }

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
          </dl>
        </div>

        {/* Editable form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="mb-4">
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
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

          <div className="mb-4">
            <label htmlFor="edit-address" className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="edit-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSaving}
              placeholder="123 Main Street"
              className={inputClass(!!addressError)}
            />
            {addressError && <p className="mt-1 text-sm text-red-600">{addressError}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="edit-postal-code" className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="edit-postal-code"
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              disabled={isSaving}
              placeholder="75001"
              className={inputClass(!!postalCodeError)}
            />
            {postalCodeError && <p className="mt-1 text-sm text-red-600">{postalCodeError}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="edit-city" className="block text-sm font-medium text-gray-700 mb-1">
              City <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="edit-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={isSaving}
              placeholder="Paris"
              className={inputClass(!!cityError)}
            />
            {cityError && <p className="mt-1 text-sm text-red-600">{cityError}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="edit-screen-count" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Screens <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="edit-screen-count"
              type="number"
              min="1"
              max="50"
              value={screenCount}
              onChange={(e) => setScreenCount(e.target.value)}
              disabled={isSaving}
              placeholder="10"
              className={inputClass(!!screenCountError)}
            />
            {screenCountError && <p className="mt-1 text-sm text-red-600">{screenCountError}</p>}
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
