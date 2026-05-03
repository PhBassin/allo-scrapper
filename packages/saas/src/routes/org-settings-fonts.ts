const SUPPORTED_GOOGLE_FONTS = [
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
  'Lora',
  'Bebas Neue',
  'Roboto Slab',
  'Karla',
] as const;

const SUPPORTED_SYSTEM_FONTS = [
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

const SAFE_FONT_VALUE_PATTERN = /^[A-Za-z0-9\s,'"-]+$/;

function extractPrimaryFontFamily(fontValue: string): string | null {
  const firstFont = fontValue
    .split(',')[0]
    ?.trim()
    .replace(/["']/g, '');

  return firstFont ? firstFont : null;
}

function matchesSupportedFont(fontName: string, supportedFonts: readonly string[]): string | null {
  const match = supportedFonts.find((font) => font.toLowerCase() === fontName.toLowerCase());
  return match ?? null;
}

export function extractSupportedGoogleFont(fontValue: string): string | null {
  if (!fontValue || !SAFE_FONT_VALUE_PATTERN.test(fontValue)) {
    return null;
  }

  const primaryFont = extractPrimaryFontFamily(fontValue);
  if (!primaryFont) {
    return null;
  }

  return matchesSupportedFont(primaryFont, SUPPORTED_GOOGLE_FONTS);
}

export function isValidThemeFontValue(fontValue: string): boolean {
  if (!fontValue || !SAFE_FONT_VALUE_PATTERN.test(fontValue)) {
    return false;
  }

  const primaryFont = extractPrimaryFontFamily(fontValue);
  if (!primaryFont) {
    return false;
  }

  return Boolean(
    extractSupportedGoogleFont(fontValue)
    || matchesSupportedFont(primaryFont, SUPPORTED_SYSTEM_FONTS)
  );
}
