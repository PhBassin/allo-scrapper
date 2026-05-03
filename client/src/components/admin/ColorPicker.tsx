import React, { useId, useState } from 'react';

interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

/**
 * Simple color picker component with live preview
 */
const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, disabled = false }) => {
    const [localValue, setLocalValue] = useState(value);
    const inputId = useId();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        onChange(newValue);
    };

    const isValidColor = /^#[0-9A-F]{6}$/i.test(localValue);

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
                {label}
            </label>
            <div className="flex items-center gap-3">
                <input
                    id={inputId}
                    type="color"
                    value={isValidColor ? localValue : '#000000'}
                    onChange={handleChange}
                    disabled={disabled}
                    aria-label={label}
                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />
                <input
                    type="text"
                    value={localValue}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder="#RRGGBB"
                    pattern="^#[0-9A-F]{6}$"
                    maxLength={7}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {!isValidColor && localValue && (
                    <span className="text-sm text-red-600">Invalid hex color</span>
                )}
            </div>
            <div 
                className="h-8 rounded border border-gray-300"
                style={{ backgroundColor: isValidColor ? localValue : '#cccccc' }}
                title="Color preview"
            />
        </div>
    );
};

export default ColorPicker;
