import React from 'react';
import type { AppSettingsUpdate } from '../../api/settings';
import ImageUpload from './ImageUpload';

interface EmailTabProps {
    value: AppSettingsUpdate;
    onChange: (field: string, value: string | null) => void;
    disabled: boolean;
}

const EmailTab: React.FC<EmailTabProps> = ({ value, onChange, disabled }) => (
    <div className="space-y-6 max-w-2xl">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                From Name
            </label>
            <input
                type="text"
                value={value.email_from_name || ''}
                onChange={(e) => onChange('email_from_name', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Theater Site"
            />
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                From Email Address
            </label>
            <input
                type="email"
                value={value.email_from_address || ''}
                onChange={(e) => onChange('email_from_address', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="noreply@example.com"
            />
        </div>

        <ImageUpload
            label="Email Logo"
            value={value.email_logo_base64 || null}
            onChange={(val) => onChange('email_logo_base64', val)}
            disabled={disabled}
            maxSizeKB={200}
        />
    </div>
);

export default EmailTab;
