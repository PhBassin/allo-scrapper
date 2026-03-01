import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractGoogleFont,
  generateGoogleFontsImport,
  generateCSSVariables,
  generateThemeCSS,
} from './theme-generator.js';
import type { AppSettingsPublic } from '../types/settings.js';
import type { DB } from '../db/client.js';

describe('extractGoogleFont', () => {
  describe('should detect Google Fonts', () => {
    it('should detect Inter as Google Font', () => {
      expect(extractGoogleFont('Inter')).toBe('Inter');
    });

    it('should detect Roboto as Google Font', () => {
      expect(extractGoogleFont('Roboto')).toBe('Roboto');
    });

    it('should detect Open Sans as Google Font', () => {
      expect(extractGoogleFont('Open Sans')).toBe('Open Sans');
    });

    it('should detect Montserrat as Google Font', () => {
      expect(extractGoogleFont('Montserrat')).toBe('Montserrat');
    });

    it('should detect Poppins as Google Font', () => {
      expect(extractGoogleFont('Poppins')).toBe('Poppins');
    });

    it('should detect Lato as Google Font', () => {
      expect(extractGoogleFont('Lato')).toBe('Lato');
    });

    it('should handle case-insensitive font names', () => {
      expect(extractGoogleFont('inter')).toBe('inter');
      expect(extractGoogleFont('ROBOTO')).toBe('ROBOTO');
      expect(extractGoogleFont('Open sans')).toBe('Open sans');
    });
  });

  describe('should NOT detect system fonts', () => {
    it('should return null for system-ui', () => {
      expect(extractGoogleFont('system-ui')).toBeNull();
    });

    it('should return null for -apple-system', () => {
      expect(extractGoogleFont('-apple-system')).toBeNull();
    });

    it('should return null for Arial', () => {
      expect(extractGoogleFont('Arial')).toBeNull();
    });

    it('should return null for sans-serif', () => {
      expect(extractGoogleFont('sans-serif')).toBeNull();
    });

    it('should return null for Helvetica', () => {
      expect(extractGoogleFont('Helvetica')).toBeNull();
    });

    it('should return null for serif', () => {
      expect(extractGoogleFont('serif')).toBeNull();
    });

    it('should return null for monospace', () => {
      expect(extractGoogleFont('monospace')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(extractGoogleFont('')).toBeNull();
    });

    it('should handle font with leading/trailing spaces', () => {
      expect(extractGoogleFont('  Inter  ')).toBe('Inter');
    });

    it('should handle font stack (take first font)', () => {
      expect(extractGoogleFont('Inter, system-ui, sans-serif')).toBe('Inter');
      expect(extractGoogleFont('Roboto, Arial, sans-serif')).toBe('Roboto');
    });

    it('should handle font with quotes', () => {
      expect(extractGoogleFont('"Inter"')).toBe('Inter');
      expect(extractGoogleFont("'Roboto'")).toBe('Roboto');
    });

    it('should return null for unknown fonts', () => {
      expect(extractGoogleFont('UnknownFont')).toBeNull();
    });

    it('should handle system font in font stack', () => {
      expect(extractGoogleFont('system-ui, sans-serif')).toBeNull();
      expect(extractGoogleFont('Arial, Helvetica, sans-serif')).toBeNull();
    });
  });
});

describe('generateGoogleFontsImport', () => {
  it('should generate import for single font', () => {
    const result = generateGoogleFontsImport(['Inter']);
    expect(result).toContain('@import url');
    expect(result).toContain('googleapis.com');
    expect(result).toContain('Inter');
    expect(result).toContain('wght@400;500;600;700');
  });

  it('should generate import for multiple fonts', () => {
    const result = generateGoogleFontsImport(['Inter', 'Roboto']);
    expect(result).toContain('Inter');
    expect(result).toContain('Roboto');
    expect(result).toContain('wght@400;500;600;700');
  });

  it('should include font weights 400,500,600,700', () => {
    const result = generateGoogleFontsImport(['Inter']);
    expect(result).toMatch(/wght@400;500;600;700/);
  });

  it('should return empty string for empty array', () => {
    const result = generateGoogleFontsImport([]);
    expect(result).toBe('');
  });

  it('should handle fonts with spaces (URL encode)', () => {
    const result = generateGoogleFontsImport(['Open Sans']);
    expect(result).toContain('Open%20Sans');
  });

  it('should deduplicate fonts', () => {
    const result = generateGoogleFontsImport(['Inter', 'Inter', 'Roboto']);
    // Should only contain Inter once
    const interMatches = (result.match(/Inter/g) || []).length;
    expect(interMatches).toBe(1);
  });

  it('should add display=swap parameter', () => {
    const result = generateGoogleFontsImport(['Inter']);
    expect(result).toContain('display=swap');
  });

  it('should generate proper Google Fonts URL format', () => {
    const result = generateGoogleFontsImport(['Inter', 'Roboto']);
    expect(result).toMatch(/family=Inter:wght@400;500;600;700/);
    expect(result).toMatch(/family=Roboto:wght@400;500;600;700/);
  });
});

describe('generateCSSVariables', () => {
  const mockSettings: AppSettingsPublic = {
    site_name: 'Test Site',
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
    font_primary: 'Inter, system-ui, sans-serif',
    font_secondary: 'Roboto, system-ui, sans-serif',
    footer_text: null,
    footer_links: [],
  };

  it('should generate all 9 color variables', () => {
    const result = generateCSSVariables(mockSettings);
    expect(result).toContain('--color-primary: #FECC00');
    expect(result).toContain('--color-secondary: #1F2937');
    expect(result).toContain('--color-accent: #3B82F6');
    expect(result).toContain('--color-background: #F9FAFB');
    expect(result).toContain('--color-surface: #FFFFFF');
    expect(result).toContain('--color-text-primary: #111827');
    expect(result).toContain('--color-text-secondary: #6B7280');
    expect(result).toContain('--color-success: #10B981');
    expect(result).toContain('--color-error: #EF4444');
  });

  it('should generate 2 font variables', () => {
    const result = generateCSSVariables(mockSettings);
    expect(result).toContain('--font-primary: Inter, system-ui, sans-serif');
    expect(result).toContain('--font-secondary: Roboto, system-ui, sans-serif');
  });

  it('should include :root wrapper', () => {
    const result = generateCSSVariables(mockSettings);
    expect(result).toContain(':root {');
    expect(result).toContain('}');
  });

  it('should use proper CSS syntax (-- prefix)', () => {
    const result = generateCSSVariables(mockSettings);
    expect(result).toMatch(/--color-\w+:/);
    expect(result).toMatch(/--font-\w+:/);
  });

  it('should preserve font stacks in CSS variables', () => {
    const result = generateCSSVariables(mockSettings);
    expect(result).toContain('Inter, system-ui, sans-serif');
    expect(result).toContain('Roboto, system-ui, sans-serif');
  });

  it('should include CSS comments for readability', () => {
    const result = generateCSSVariables(mockSettings);
    expect(result).toContain('/*');
    expect(result).toContain('*/');
  });

  it('should handle custom colors', () => {
    const customSettings = {
      ...mockSettings,
      color_primary: '#FF0000',
      color_secondary: '#00FF00',
    };
    const result = generateCSSVariables(customSettings);
    expect(result).toContain('--color-primary: #FF0000');
    expect(result).toContain('--color-secondary: #00FF00');
  });
});

describe('generateThemeCSS', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
  });

  it('should generate complete CSS with Google Fonts import', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          site_name: 'Test',
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
          font_primary: 'Inter, sans-serif',
          font_secondary: 'Roboto, sans-serif',
          footer_text: null,
          footer_links: '[]',
          email_from_name: 'Test',
          email_from_address: 'test@test.com',
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
      ],
    });

    const css = await generateThemeCSS(mockDb);
    expect(css).toContain('@import url');
    expect(css).toContain('googleapis.com');
    expect(css).toContain('Inter');
    expect(css).toContain('Roboto');
  });

  it('should generate CSS without import for system fonts', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          site_name: 'Test',
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
          font_primary: 'system-ui, sans-serif',
          font_secondary: 'Arial, sans-serif',
          footer_text: null,
          footer_links: '[]',
          email_from_name: 'Test',
          email_from_address: 'test@test.com',
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
      ],
    });

    const css = await generateThemeCSS(mockDb);
    expect(css).not.toContain('@import url');
    expect(css).not.toContain('googleapis.com');
  });

  it('should include CSS variables', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          site_name: 'Test',
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
          font_primary: 'Inter, sans-serif',
          font_secondary: 'Roboto, sans-serif',
          footer_text: null,
          footer_links: '[]',
          email_from_name: 'Test',
          email_from_address: 'test@test.com',
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
      ],
    });

    const css = await generateThemeCSS(mockDb);
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
    expect(css).toContain('--font-primary');
  });

  it('should handle database returning no rows (use defaults)', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [],
    });

    const css = await generateThemeCSS(mockDb);
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
    expect(css).toBeDefined();
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('DB connection failed'));

    const css = await generateThemeCSS(mockDb);
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
    expect(css).toBeDefined();
  });

  it('should return valid CSS structure', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          site_name: 'Test',
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
          font_primary: 'Inter, sans-serif',
          font_secondary: 'Roboto, sans-serif',
          footer_text: null,
          footer_links: '[]',
          email_from_name: 'Test',
          email_from_address: 'test@test.com',
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
      ],
    });

    const css = await generateThemeCSS(mockDb);
    expect(css).toContain('@charset');
    expect(css).toContain(':root');
  });

  it('should include charset declaration', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          site_name: 'Test',
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
          font_primary: 'Inter, sans-serif',
          font_secondary: 'Roboto, sans-serif',
          footer_text: null,
          footer_links: '[]',
          email_from_name: 'Test',
          email_from_address: 'test@test.com',
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
      ],
    });

    const css = await generateThemeCSS(mockDb);
    expect(css).toContain('@charset "UTF-8"');
  });
});
