import React, { useState } from 'react';

interface PasswordResetDialogProps {
  isOpen: boolean;
  username: string;
  newPassword: string;
  onClose: () => void;
}

const PasswordResetDialog: React.FC<PasswordResetDialogProps> = ({
  isOpen,
  username,
  newPassword,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy password:', error);
    }
  };

  // Prevent backdrop click from closing (force user to use Close button)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Do nothing - we want to force users to click the Close button
    // to ensure they've read the warning
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="dialog-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
          <h2 className="text-xl font-semibold text-green-900">
            ✅ Password Reset Successful
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">
            The password for user <span className="font-semibold">{username}</span> has been reset.
          </p>

          {/* Password Display */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPassword}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Password'}
              </button>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ Save this password now!
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              This password will only be shown once. Make sure to save it before closing this dialog.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetDialog;
