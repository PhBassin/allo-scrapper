import React from 'react';
import type { AppSettingsUpdate } from '../../api/settings';
import ImageUpload from './ImageUpload';

interface GeneralTabProps {
    value: AppSettingsUpdate;
    onChange: (field: string, value: string | null) => void;
    disabled: boolean;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ value, onChange, disabled }) => (
    <div className="space-y-6 max-w-2xl">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Site Name
            </label>
            <input
                type="text"
                value={value.site_name || ''}
                onChange={(e) => onChange('site_name', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Theater Site"
            />
        </div>

        <ImageUpload
            label="Logo"
            value={value.logo_base64 || null}
            onChange={(val) => onChange('logo_base64', val)}
            disabled={disabled}
            maxSizeKB={200}
        />

        <ImageUpload
            label="Favicon"
            value={value.favicon_base64 || null}
            onChange={(val) => onChange('favicon_base64', val)}
            disabled={disabled}
            maxSizeKB={50}
        />
    </div>
);

export default GeneralTab;
