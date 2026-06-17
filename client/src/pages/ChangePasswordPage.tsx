import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import type { ApiError } from '../api/client.js';
import PasswordRequirements from '../components/PasswordRequirements.js';
import { validateChangePasswordForm } from '../utils/userValidators.js';

const ChangePasswordPage: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const validationError = validateChangePasswordForm(currentPassword, newPassword, confirmPassword);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);

        try {
            const response = await apiClient.post<{
                success: boolean;
                data?: { message: string };
                error?: string;
            }>('/auth/change-password', {
                currentPassword,
                newPassword,
            });

            if (response.success && response.data) {
                setSuccess(response.data.message);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => navigate('/'), 2000);
            } else {
                setError(response.error || 'Failed to change password');
            }
        } catch (err: unknown) {
            setError(extractApiError(err));
            console.error('Change password error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => navigate('/');

    return (
        <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Change Password</h2>

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm relative" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded text-sm relative" role="alert">
                        <span className="block sm:inline">{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <PasswordField
                        id="currentPassword"
                        label="Current Password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        disabled={isLoading}
                    />
                    <PasswordField
                        id="newPassword"
                        label="New Password"
                        value={newPassword}
                        onChange={setNewPassword}
                        disabled={isLoading}
                        showRequirements
                    />
                    <PasswordField
                        id="confirmPassword"
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        disabled={isLoading}
                    />

                    <div className="flex gap-3">
                        <button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Changing...' : 'Change Password'}
                        </button>
                        <button
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors disabled:opacity-50"
                            type="button"
                            onClick={handleCancel}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface PasswordFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
    showRequirements?: boolean;
}

function PasswordField({ id, label, value, onChange, disabled, showRequirements }: PasswordFieldProps) {
    return (
        <div className={`mb-${showRequirements ? '4' : '6'}`}>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id}>
                {label}
            </label>
            <input
                className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                id={id}
                type="password"
                placeholder="********"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                disabled={disabled}
            />
            {showRequirements && <PasswordRequirements password={value} />}
        </div>
    );
}

function extractApiError(err: unknown): string {
    if (err instanceof Error && ('status' in err || 'data' in err)) {
        const apiError = err as ApiError;
        if (apiError.data?.error) return apiError.data.error;
    }
    return 'An unexpected error occurred. Please try again later.';
}

export default ChangePasswordPage;