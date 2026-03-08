import React from 'react';
import type { Cinema } from '../../types';

interface DeleteCinemaDialogProps {
  isOpen: boolean;
  cinema: Cinema;
  onClose: () => void;
  onConfirm: (cinemaId: string) => void;
  isDeleting?: boolean;
  error?: string | null;
}

const DeleteCinemaDialog: React.FC<DeleteCinemaDialogProps> = ({
  isOpen,
  cinema,
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
    onConfirm(cinema.id);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="delete-cinema-dialog-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Delete Cinema</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete cinema{' '}
            <span className="font-semibold">{cinema.name}</span>{' '}
            <span className="text-gray-500">({cinema.id})</span>?
          </p>

          {cinema.city && (
            <p className="text-sm text-gray-500 mb-4">{cinema.city}</p>
          )}

          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 font-medium">
              ⚠️ This action cannot be undone
            </p>
            <p className="text-sm text-red-700 mt-1">
              All showtimes and weekly programs associated with this cinema will be permanently deleted.
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
            data-testid="delete-cinema-cancel-button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid="delete-cinema-confirm-button"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteCinemaDialog;
