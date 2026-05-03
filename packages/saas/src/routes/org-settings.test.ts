import { describe, it, expect } from 'vitest';
import { normalizeImportSettings } from './org-settings.js';

describe('normalizeImportSettings', () => {
  it('keeps canonical settings payloads unchanged', () => {
    const canonicalPayload = {
      site_name: 'Acme Cinema',
      color_primary: '#FECC00',
      color_secondary: '#1F2937',
      color_accent: '#3B82F6',
      color_background: '#FFFFFF',
      color_surface: '#F3F4F6',
      color_text_primary: '#111827',
      color_text_secondary: '#6B7280',
      color_success: '#10B981',
      color_error: '#EF4444',
      font_primary: 'Inter',
      font_secondary: 'Roboto',
      footer_text: 'Footer',
      footer_links: [{ label: 'Privacy', url: '/privacy' }],
      scrape_mode: 'weekly',
      scrape_days: 7,
    };

    const result = normalizeImportSettings(canonicalPayload);

    expect(result).toMatchObject(canonicalPayload);
    expect(result).not.toHaveProperty('color_border');
    expect(result).not.toHaveProperty('color_text');
    expect(result).not.toHaveProperty('font_family_heading');
    expect(result).not.toHaveProperty('font_family_body');
  });

  it('maps legacy import keys to canonical keys', () => {
    const legacyPayload = {
      site_name: 'Legacy Cinema',
      color_border: '#E5E7EB',
      color_text: '#1F2937',
      color_text_secondary: '#6B7280',
      font_family_heading: 'Playfair Display',
      font_family_body: 'Roboto',
      footer_links: [{ text: 'Terms', url: '/terms' }],
    };

    const result = normalizeImportSettings(legacyPayload);

    expect(result.color_surface).toBe('#E5E7EB');
    expect(result.color_text_primary).toBe('#1F2937');
    expect(result.color_text_secondary).toBe('#6B7280');
    expect(result.font_primary).toBe('Playfair Display');
    expect(result.font_secondary).toBe('Roboto');
    expect(result.footer_links).toEqual([
      { label: 'Terms', text: 'Terms', url: '/terms' },
    ]);
    expect(result).not.toHaveProperty('color_border');
    expect(result).not.toHaveProperty('color_text');
    expect(result).not.toHaveProperty('font_family_heading');
    expect(result).not.toHaveProperty('font_family_body');
  });
});
