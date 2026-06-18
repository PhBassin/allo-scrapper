import type { AppSettings } from '../api/settings';

/**
 * Extract the shared public subset of fields from an AppSettings payload.
 * Used as the basis for both the AppSettingsPublic mapping (in
 * SettingsProvider) and the AppSettingsUpdate form initializer
 * (in useSettingsForm), so any new field only needs to be added in one place.
 */
export function getPublicFields(settings: AppSettings) {
  return {
    site_name: settings.site_name,
    logo_base64: settings.logo_base64,
    favicon_base64: settings.favicon_base64,
    color_primary: settings.color_primary,
    color_secondary: settings.color_secondary,
    color_accent: settings.color_accent,
    color_background: settings.color_background,
    color_text: settings.color_text,
    color_text_secondary: settings.color_text_secondary,
    color_border: settings.color_border,
    color_success: settings.color_success,
    color_error: settings.color_error,
    font_family_heading: settings.font_family_heading,
    font_family_body: settings.font_family_body,
    footer_text: settings.footer_text,
    footer_links: settings.footer_links,
  };
}