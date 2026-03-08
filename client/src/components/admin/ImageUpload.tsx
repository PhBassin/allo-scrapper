import React, { useState, useRef } from 'react';

interface ImageUploadProps {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    maxSizeKB: number; // Max file size in KB (200 for logo, 50 for favicon)
    accept?: string; // File types to accept
}

/**
 * Image upload component with client-side validation and preview
 * Validates file size and converts to base64 data URL
 */
const ImageUpload: React.FC<ImageUploadProps> = ({ 
    label, 
    value, 
    onChange, 
    disabled = false,
    maxSizeKB,
    accept = 'image/png,image/jpeg,image/jpg'
}) => {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setIsLoading(true);

        // Validate file type
        if (!accept.includes(file.type)) {
            setError(`Invalid file type. Accepted: ${accept}`);
            setIsLoading(false);
            return;
        }

        // Validate file size
        const fileSizeKB = file.size / 1024;
        if (fileSizeKB > maxSizeKB) {
            setError(`File too large. Maximum size: ${maxSizeKB}KB (current: ${Math.round(fileSizeKB)}KB)`);
            setIsLoading(false);
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            onChange(base64);
            setIsLoading(false);
        };
        reader.onerror = () => {
            setError('Failed to read file');
            setIsLoading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleRemove = () => {
        onChange(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClickUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
                {label}
            </label>
            
            <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                    {value ? (
                        <img 
                            src={value} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain"
                        />
                    ) : (
                        <div className="text-center p-2">
                            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-xs text-gray-500 mt-1">No image</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex-1 flex flex-col gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={accept}
                        onChange={handleFileSelect}
                        disabled={disabled || isLoading}
                        className="hidden"
                    />
                    
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleClickUpload}
                            disabled={disabled || isLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Loading...' : value ? 'Change' : 'Upload'}
                        </button>
                        
                        {value && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={disabled || isLoading}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                Remove
                            </button>
                        )}
                    </div>

                    <p className="text-xs text-gray-600">
                        Max size: {maxSizeKB}KB • Formats: PNG, JPEG
                    </p>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageUpload;
