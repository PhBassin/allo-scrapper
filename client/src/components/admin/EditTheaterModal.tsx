import { useEditTheaterForm } from '../../hooks/useEditTheaterForm';
import type { Theater } from '../../types';
import type { TheaterUpdate } from '../../api/theaters';

/**
 * Modal for editing a theater's information.
 *
 * IMPORTANT: The parent must supply `key={theater.id}` when rendering this
 * component so React remounts it whenever the selected theater changes.
 * Without this, useState initial values are only applied on first mount,
 * causing stale data when switching between theaters without closing:
 *
 *   {theaterToEdit && (
 *     <EditTheaterModal
 *       key={theaterToEdit.id}
 *       isOpen={true}
 *       theater={theaterToEdit}
 *       onClose={() => setTheaterToEdit(null)}
 *       onSave={handleUpdateTheater}
 *     />
 *   )}
 */

interface EditTheaterModalProps {
  isOpen: boolean;
  theater: Theater;
  onClose: () => void;
  onSave: (id: string, updates: TheaterUpdate) => Promise<void>;
}

const EditTheaterModal: React.FC<EditTheaterModalProps> = ({ isOpen, theater, onClose, onSave }) => {
  if (!isOpen) return null;

  const {
    name, setName,
    url, setUrl,
    address, setAddress,
    postalCode, setPostalCode,
    city, setCity,
    screenCount, setScreenCount,
    nameError, urlError, addressError, postalCodeError, cityError, screenCountError,
    submitError,
    isSaving, hasChanges,
    handleSubmit, handleBackdropClick,
    inputClass,
  } = useEditTheaterForm(theater, onSave, onClose);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="edit-theater-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Edit Theater</h2>
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
            <dd className="font-mono text-gray-900">{theater.id}</dd>
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

export default EditTheaterModal;
