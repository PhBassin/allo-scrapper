import React, { useEffect, useSyncExternalStore } from 'react';

interface FontSelectorProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    type?: 'heading' | 'body';
}

const POPULAR_FONTS = {
    heading: [
        'Playfair Display',
        'Montserrat',
        'Oswald',
        'Raleway',
        'Merriweather',
        'Lora',
        'Bebas Neue',
        'Poppins',
        'Roboto Slab',
    ],
    body: [
        'Roboto',
        'Open Sans',
        'Lato',
        'Source Sans Pro',
        'Nunito',
        'Inter',
        'Work Sans',
        'PT Sans',
        'Karla',
    ],
};

function subscribeToFontLoad(callback: () => void): () => void {
    document.fonts.ready.then(callback);
    const interval = setInterval(() => {
        if (document.fonts.status === 'loaded') {
            clearInterval(interval);
            callback();
        }
    }, 100);
    return () => clearInterval(interval);
}

function useFontLoaded(fontFamily: string): boolean {
    return useSyncExternalStore(
        subscribeToFontLoad,
        () => document.fonts.check(`12px "${fontFamily}"`),
        () => false
    );
}

const FontSelector: React.FC<FontSelectorProps> = ({ 
    label, 
    value, 
    onChange, 
    disabled = false,
    type = 'body'
}) => {
    const fonts = POPULAR_FONTS[type];
    const fontLoaded = useFontLoaded(value);

    useEffect(() => {
        if (!value) return;

        const linkId = `font-${value.replace(/\s+/g, '-')}`;
        let link = document.getElementById(linkId) as HTMLLinkElement;

        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${value.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            document.head.appendChild(link);
        }
    }, [value]);

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
                {label}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                {fonts.map((font) => (
                    <option key={font} value={font}>
                        {font}
                    </option>
                ))}
            </select>
            <div 
                className="p-4 border border-gray-300 rounded bg-gray-50 min-h-[80px] flex items-center justify-center"
                style={{ 
                    fontFamily: fontLoaded ? `"${value}", sans-serif` : 'sans-serif',
                    fontSize: type === 'heading' ? '24px' : '16px',
                    fontWeight: type === 'heading' ? 700 : 400,
                }}
            >
                {fontLoaded ? (
                    <span>The quick brown fox jumps over the lazy dog</span>
                ) : (
                    <span className="text-gray-400">Loading font...</span>
                )}
            </div>
        </div>
    );
};

export default FontSelector;
