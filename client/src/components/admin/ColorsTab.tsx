import React from 'react';
import type { AppSettingsUpdate } from '../../api/settings';
import ColorPicker from './ColorPicker';

const COLOR_FIELDS = [
    { field: 'color_primary', label: 'Primary Color', default: '#FECC00' },
    { field: 'color_secondary', label: 'Secondary Color', default: '#1E40AF' },
    { field: 'color_accent', label: 'Accent Color', default: '#10B981' },
    { field: 'color_background', label: 'Background Color', default: '#FFFFFF' },
    { field: 'color_text', label: 'Text Color', default: '#1F2937' },
    { field: 'color_text_secondary', label: 'Secondary Text Color', default: '#6B7280' },
    { field: 'color_border', label: 'Border Color', default: '#E5E7EB' },
    { field: 'color_success', label: 'Success Color', default: '#10B981' },
    { field: 'color_error', label: 'Error Color', default: '#EF4444' },
] as const;

interface ColorsTabProps {
    value: AppSettingsUpdate;
    onChange: (field: string, value: string | null) => void;
    disabled: boolean;
}

const ColorsTab: React.FC<ColorsTabProps> = ({ value, onChange, disabled }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {COLOR_FIELDS.map(({ field, label, default: defaultVal }) => (
            <ColorPicker
                key={field}
                label={label}
                value={(value as Record<string, string | null | undefined>)[field] || defaultVal}
                onChange={(val) => onChange(field, val)}
                disabled={disabled}
            />
        ))}
    </div>
);

export default ColorsTab;
