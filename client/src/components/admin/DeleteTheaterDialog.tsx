import React from 'react';
import type { Theater } from '../../types';

interface DeleteTheaterDialogProps {
  isOpen: boolean;
  theater: Theater;
  onClose: () => void;
  onConfirm: (theaterId: string) => void;
  isDeleting?: boolean;
  error?: string | null;
}

const DeleteTheaterDialog: React.FC<DeleteTheaterDialogProps> = ({
  isOpen,
  theater,
  onClose,
  onConfirm,
  isDeleting = false,
  error = null,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isDeleting) onClose();
  };

  const handleConfirm = () => {
    onConfirm(theater.id);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="delete-theater-dialog-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Delete Theater</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete theater{' '}
            <span className="font-semibold">{theater.name}</span>{' '}
            <span className="text-gray-500">({theater.id})</span>?
          </p>

          {theater.city && (
            <p className="text-sm text-gray-500 mb-4">{theater.city}</p>
          )}

          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 font-medium">
              ⚠️ This action cannot be undone
            </p>
            <p className="text-sm text-red-700 mt-1">
              All showtimes and weekly programs associated with this theater will be permanently deleted.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="delete-theater-cancel-button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid="delete-theater-confirm-button"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTheaterDialog;
