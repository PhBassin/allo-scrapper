import React from 'react';
import type { AppSettingsUpdate } from '../../api/settings';
import FontSelector from './FontSelector';

interface TypographyTabProps {
    value: AppSettingsUpdate;
    onChange: (field: string, value: string | null) => void;
    disabled: boolean;
}

const TypographyTab: React.FC<TypographyTabProps> = ({ value, onChange, disabled }) => (
    <div className="space-y-6 max-w-2xl">
        <FontSelector
            label="Heading Font"
            value={value.font_family_heading || 'Playfair Display'}
            onChange={(val) => onChange('font_family_heading', val)}
            disabled={disabled}
            type="heading"
        />
        <FontSelector
            label="Body Font"
            value={value.font_family_body || 'Roboto'}
            onChange={(val) => onChange('font_family_body', val)}
            disabled={disabled}
            type="body"
        />
    </div>
);

export default TypographyTab;
