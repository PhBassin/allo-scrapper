import React from 'react';
import type { AppSettingsUpdate, FooterLink } from '../../api/settings';
import FooterLinksEditor from './FooterLinksEditor';

interface FooterTabProps {
    value: AppSettingsUpdate;
    onChange: (field: string, value: string | FooterLink[] | null) => void;
    disabled: boolean;
}

const FooterTab: React.FC<FooterTabProps> = ({ value, onChange, disabled }) => (
    <div className="space-y-6 max-w-3xl">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Footer Text
            </label>
            <textarea
                value={value.footer_text || ''}
                onChange={(e) => onChange('footer_text', e.target.value)}
                disabled={disabled}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="© 2024 My Theater Site. All rights reserved."
            />
        </div>

        <FooterLinksEditor
            value={value.footer_links || []}
            onChange={(val) => onChange('footer_links', val as FooterLink[])}
            disabled={disabled}
        />
    </div>
);

export default FooterTab;
