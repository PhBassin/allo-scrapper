import React, { useState, useEffect } from 'react';

interface FontSelectorProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    type?: 'heading' | 'body';
}

// Popular Google Fonts categorized by use case
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

/**
 * Font selector with Google Fonts integration and live preview
 */
const FontSelector: React.FC<FontSelectorProps> = ({ 
    label, 
    value, 
    onChange, 
    disabled = false,
    type = 'body'
}) => {
    const [fontLoaded, setFontLoaded] = useState(false);
    const fonts = POPULAR_FONTS[type];

    // Load selected font from Google Fonts
    useEffect(() => {
        if (!value) return;

        setFontLoaded(false);

        // Check if font is already loaded
        if (document.fonts.check(`12px "${value}"`)) {
            setFontLoaded(true);
            return;
        }

        // Create link element to load font
        const linkId = `font-${value.replace(/\s+/g, '-')}`;
        let link = document.getElementById(linkId) as HTMLLinkElement;

        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${value.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            document.head.appendChild(link);
        }

        // Wait for font to load
        const fontFace = new FontFaceObserver(value);
        fontFace.load().then(() => {
            setFontLoaded(true);
        }).catch(() => {
            console.warn(`Failed to load font: ${value}`);
            setFontLoaded(true); // Show anyway
        });

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

// Simple FontFaceObserver polyfill
class FontFaceObserver {
    private family: string;

    constructor(family: string) {
        this.family = family;
    }

    load(timeout = 3000): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Font load timeout')), timeout);

            if ('fonts' in document) {
                document.fonts.ready.then(() => {
                    clearTimeout(timeoutId);
                    // Check if our specific font is loaded
                    if (document.fonts.check(`12px "${this.family}"`)) {
                        resolve();
                    } else {
                        // Wait a bit more
                        setTimeout(() => {
                            if (document.fonts.check(`12px "${this.family}"`)) {
                                resolve();
                            } else {
                                reject(new Error('Font not found'));
                            }
                        }, 500);
                    }
                });
            } else {
                // Fallback: just wait a bit
                setTimeout(() => {
                    clearTimeout(timeoutId);
                    resolve();
                }, 1000);
            }
        });
    }
}

export default FontSelector;
