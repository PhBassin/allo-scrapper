/**
 * Dark Mode Color Palette Generator
 * 
 * Intelligently generates dark mode colors from light mode colors using
 * Material Design dark theme principles.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Generate a lighter version of a color for dark mode
 * Increases lightness while maintaining hue and saturation
 */
export function generateDarkModeColor(lightColor: string, type: 'primary' | 'secondary' | 'accent' | 'text' | 'surface'): string {
  const rgb = hexToRgb(lightColor);
  if (!rgb) return lightColor;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Adjust based on color type
  switch (type) {
    case 'primary':
    case 'secondary':
    case 'accent':
      // Brand colors: lighten significantly and slightly desaturate
      hsl.l = Math.min(75, hsl.l + 30);
      hsl.s = Math.max(40, hsl.s - 10);
      break;

    case 'text':
      // Text colors: very light with low saturation
      hsl.l = 85;
      hsl.s = Math.min(10, hsl.s);
      break;

    case 'surface':
      // Surface colors: dark with very low saturation
      hsl.l = 12;
      hsl.s = Math.min(5, hsl.s);
      break;
  }

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Generate a complete dark mode color palette from light mode colors
 */
export interface DarkModePalette {
  color_primary_dark: string;
  color_secondary_dark: string;
  color_accent_dark: string;
  color_background_dark: string;
  color_surface_dark: string;
  color_text_primary_dark: string;
  color_text_secondary_dark: string;
  color_success_dark: string;
  color_error_dark: string;
}

export function generateDarkPalette(lightColors: {
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_surface: string;
  color_text_primary: string;
  color_text_secondary: string;
  color_success: string;
  color_error: string;
}): DarkModePalette {
  return {
    color_primary_dark: generateDarkModeColor(lightColors.color_primary, 'primary'),
    color_secondary_dark: generateDarkModeColor(lightColors.color_secondary, 'secondary'),
    color_accent_dark: generateDarkModeColor(lightColors.color_accent, 'accent'),
    // Material Design dark theme backgrounds
    color_background_dark: '#121212',
    color_surface_dark: '#1E1E1E',
    // Text colors
    color_text_primary_dark: '#E0E0E0',
    color_text_secondary_dark: '#9E9E9E',
    // Status colors: slightly lighter versions
    color_success_dark: generateDarkModeColor(lightColors.color_success, 'accent'),
    color_error_dark: generateDarkModeColor(lightColors.color_error, 'accent'),
  };
}
