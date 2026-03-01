import type { DB } from '../db/client.js';
import { getPublicSettings } from '../db/settings-queries.js';
import type { AppSettingsPublic } from '../types/settings.js';
import { logger } from '../utils/logger.js';

/**
 * Hardcoded list of popular Google Fonts
 * These fonts will trigger Google Fonts import when detected
 */
const GOOGLE_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Nunito',
  'PT Sans',
  'Source Sans Pro',
  'Work Sans',
  'Archivo',
  'Manrope',
  'DM Sans',
  'Plus Jakarta Sans',
  'Ubuntu',
  'Playfair Display',
  'Merriweather',
  'Oswald',
  'Noto Sans',
] as const;

/**
 * System fonts that should NOT trigger Google Fonts import
 */
const SYSTEM_FONTS = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Arial',
  'Helvetica',
  'sans-serif',
  'serif',
  'monospace',
  'Georgia',
  'Times New Roman',
  'Courier New',
] as const;

/**
 * Default settings fallback when database is unavailable or settings are missing
 */
const DEFAULT_SETTINGS: AppSettingsPublic = {
  site_name: 'Allo-Scrapper',
  logo_base64: null,
  favicon_base64: null,
  color_primary: '#FECC00',
  color_secondary: '#1F2937',
  color_accent: '#3B82F6',
  color_background: '#F9FAFB',
  color_surface: '#FFFFFF',
  color_text_primary: '#111827',
  color_text_secondary: '#6B7280',
  color_success: '#10B981',
  color_error: '#EF4444',
  font_primary: 'system-ui, -apple-system, sans-serif',
  font_secondary: 'system-ui, -apple-system, sans-serif',
  footer_text: null,
  footer_links: [],
};

/**
 * Extracts Google Font name from a font string
 * 
 * @param fontString - Font family string (may include fallbacks like "Inter, sans-serif")
 * @returns Font family name if it's a Google Font, null if it's a system font or unknown
 * 
 * @example
 * extractGoogleFont('Inter, sans-serif') // => 'Inter'
 * extractGoogleFont('system-ui') // => null
 * extractGoogleFont('Arial, Helvetica') // => null
 */
export function extractGoogleFont(fontString: string): string | null {
  if (!fontString || fontString.trim() === '') {
    return null;
  }

  // Extract first font from font stack (e.g., "Inter, sans-serif" → "Inter")
  // Remove quotes and trim whitespace
  const firstFont = fontString
    .split(',')[0]
    .trim()
    .replace(/['"]/g, '');

  if (firstFont === '') {
    return null;
  }

  // Check if it's a system font (case-insensitive)
  const isSystemFont = SYSTEM_FONTS.some(
    (sf) => sf.toLowerCase() === firstFont.toLowerCase()
  );
  
  if (isSystemFont) {
    return null;
  }

  // Check if it's in our Google Fonts list (case-insensitive)
  const isGoogleFont = GOOGLE_FONTS.some(
    (gf) => gf.toLowerCase() === firstFont.toLowerCase()
  );

  // Return the original casing from the input if it's a Google Font
  return isGoogleFont ? firstFont : null;
}

/**
 * Generates CSS @import statement for Google Fonts
 * 
 * @param fonts - Array of Google Font family names (deduplication happens automatically)
 * @returns CSS @import statement with specified fonts and weights, or empty string if no fonts
 * 
 * @example
 * generateGoogleFontsImport(['Inter', 'Roboto'])
 * // => "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;600;700&display=swap');\n\n"
 */
export function generateGoogleFontsImport(fonts: string[]): string {
  if (fonts.length === 0) {
    return '';
  }

  // Deduplicate fonts (preserve original casing of first occurrence)
  const uniqueFonts = [...new Set(fonts)];

  // Build Google Fonts URL with font families and weights
  // Format: family=FontName:wght@400;500;600;700
  const fontParams = uniqueFonts
    .map((font) => `family=${encodeURIComponent(font)}:wght@400;500;600;700`)
    .join('&');

  // Add display=swap for better performance (prevents invisible text during font loading)
  return `@import url('https://fonts.googleapis.com/css2?${fontParams}&display=swap');\n\n`;
}

/**
 * Generates CSS custom properties (:root variables) from app settings
 * 
 * @param settings - App settings object with colors and fonts
 * @returns CSS string with :root block containing custom properties
 * 
 * @example
 * generateCSSVariables(settings)
 * // => "CSS string with :root { --color-primary: #FECC00; ... }"
 */
export function generateCSSVariables(settings: AppSettingsPublic): string {
  return `/* CSS Custom Properties - Auto-generated from app_settings */
:root {
  /* Brand Colors */
  --color-primary: ${settings.color_primary};
  --color-secondary: ${settings.color_secondary};
  --color-accent: ${settings.color_accent};
  
  /* Surface Colors */
  --color-background: ${settings.color_background};
  --color-surface: ${settings.color_surface};
  
  /* Text Colors */
  --color-text-primary: ${settings.color_text_primary};
  --color-text-secondary: ${settings.color_text_secondary};
  
  /* Status Colors */
  --color-success: ${settings.color_success};
  --color-error: ${settings.color_error};
  
  /* Typography */
  --font-primary: ${settings.font_primary};
  --font-secondary: ${settings.font_secondary};
}
`;
}

/**
 * Generates complete theme CSS from app settings stored in the database
 * 
 * Includes:
 * - Charset declaration
 * - Google Fonts @import (if Google Fonts are used)
 * - CSS custom properties for colors and fonts
 * 
 * @param db - Database client instance
 * @returns Complete CSS string ready to be served
 * 
 * @throws Never - Errors are caught and logged, defaults are used as fallback
 * 
 * @example
 * const css = await generateThemeCSS(db);
 * res.set('Content-Type', 'text/css').send(css);
 */
export async function generateThemeCSS(db: DB): Promise<string> {
  try {
    // Fetch public settings from database
    let settings = await getPublicSettings(db);

    // Use defaults if settings not found in database
    if (!settings) {
      logger.warn('No settings found in database, using defaults for theme CSS');
      settings = DEFAULT_SETTINGS;
    }

    // Detect Google Fonts from primary and secondary font settings
    const googleFonts: string[] = [];

    const primaryFont = extractGoogleFont(settings.font_primary);
    if (primaryFont) {
      googleFonts.push(primaryFont);
    }

    const secondaryFont = extractGoogleFont(settings.font_secondary);
    if (secondaryFont) {
      googleFonts.push(secondaryFont);
    }

    // Build complete CSS document
    const parts: string[] = [
      '/* Auto-generated theme CSS from Allo-Scrapper white-label settings */',
      '@charset "UTF-8";',
      '',
    ];

    // Add Google Fonts import if any Google Fonts detected
    const fontsImport = generateGoogleFontsImport(googleFonts);
    if (fontsImport) {
      parts.push(fontsImport);
    }

    // Add CSS custom properties
    parts.push(generateCSSVariables(settings));

    return parts.join('\n');
  } catch (err) {
    logger.error('Error generating theme CSS, using defaults', { error: err });

    // Return minimal fallback CSS on error (don't fail hard)
    return `/* Auto-generated theme CSS from Allo-Scrapper white-label settings */
@charset "UTF-8";

${generateCSSVariables(DEFAULT_SETTINGS)}`;
  }
}
