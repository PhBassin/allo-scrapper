import React from 'react';
import type { FooterLink } from '../../api/settings';

interface FooterLinksEditorProps {
    value: FooterLink[];
    onChange: (value: FooterLink[]) => void;
    disabled?: boolean;
}

/**
 * Editor for managing footer links array
 * Allows adding, removing, and reordering links
 */
const FooterLinksEditor: React.FC<FooterLinksEditorProps> = ({ 
    value, 
    onChange, 
    disabled = false 
}) => {
    const handleAdd = () => {
        onChange([...value, { label: '', url: '' }]);
    };

    const handleRemove = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const handleUpdate = (index: number, field: 'label' | 'url', newValue: string) => {
        const updated = value.map((link, i) => 
            i === index ? { ...link, [field]: newValue } : link
        );
        onChange(updated);
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const updated = [...value];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        onChange(updated);
    };

    const handleMoveDown = (index: number) => {
        if (index === value.length - 1) return;
        const updated = [...value];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        onChange(updated);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                    Footer Links
                </label>
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={disabled}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    + Add Link
                </button>
            </div>

            {value.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">No footer links yet</p>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={disabled}
                        className="mt-2 text-blue-600 hover:text-blue-700 underline"
                    >
                        Add your first link
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {value.map((link, index) => (
                        <div 
                            key={index}
                            className="flex items-start gap-2 p-3 border border-gray-300 rounded-lg bg-white"
                        >
                            {/* Reorder buttons */}
                            <div className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleMoveUp(index)}
                                    disabled={disabled || index === 0}
                                    className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMoveDown(index)}
                                    disabled={disabled || index === value.length - 1}
                                    className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Input fields */}
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-600">Label</label>
                                    <input
                                        type="text"
                                        value={link.label}
                                        onChange={(e) => handleUpdate(index, 'label', e.target.value)}
                                        disabled={disabled}
                                        placeholder="e.g., Privacy Policy"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600">URL</label>
                                    <input
                                        type="url"
                                        value={link.url}
                                        onChange={(e) => handleUpdate(index, 'url', e.target.value)}
                                        disabled={disabled}
                                        placeholder="https://example.com/privacy"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* Remove button */}
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                disabled={disabled}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Remove link"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FooterLinksEditor;
