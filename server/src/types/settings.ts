// White-label settings types

export interface FooterLink {
  label: string;
  url: string;
}

export interface AppSettings {
  id: number;
  site_name: string;
  logo_base64: string | null;
  favicon_base64: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_surface: string;
  color_text_primary: string;
  color_text_secondary: string;
  color_success: string;
  color_error: string;
  // Dark mode colors
  color_primary_dark: string;
  color_secondary_dark: string;
  color_accent_dark: string;
  color_background_dark: string;
  color_surface_dark: string;
  color_text_primary_dark: string;
  color_text_secondary_dark: string;
  color_success_dark: string;
  color_error_dark: string;
  font_primary: string;
  font_secondary: string;
  footer_text: string | null;
  footer_links: FooterLink[];
  email_from_name: string;
  email_from_address: string;
  updated_at: string;
  updated_by: number | null;
}

// Public version of settings (excludes sensitive fields)
export interface AppSettingsPublic {
  site_name: string;
  logo_base64: string | null;
  favicon_base64: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_surface: string;
  color_text_primary: string;
  color_text_secondary: string;
  color_success: string;
  color_error: string;
  // Dark mode colors
  color_primary_dark: string;
  color_secondary_dark: string;
  color_accent_dark: string;
  color_background_dark: string;
  color_surface_dark: string;
  color_text_primary_dark: string;
  color_text_secondary_dark: string;
  color_success_dark: string;
  color_error_dark: string;
  font_primary: string;
  font_secondary: string;
  footer_text: string | null;
  footer_links: FooterLink[];
}

// Updatable fields for PUT /api/settings
export interface AppSettingsUpdate {
  site_name?: string;
  logo_base64?: string | null;
  favicon_base64?: string | null;
  color_primary?: string;
  color_secondary?: string;
  color_accent?: string;
  color_background?: string;
  color_surface?: string;
  color_text_primary?: string;
  color_text_secondary?: string;
  color_success?: string;
  color_error?: string;
  // Dark mode colors
  color_primary_dark?: string;
  color_secondary_dark?: string;
  color_accent_dark?: string;
  color_background_dark?: string;
  color_surface_dark?: string;
  color_text_primary_dark?: string;
  color_text_secondary_dark?: string;
  color_success_dark?: string;
  color_error_dark?: string;
  font_primary?: string;
  font_secondary?: string;
  footer_text?: string | null;
  footer_links?: FooterLink[];
  email_from_name?: string;
  email_from_address?: string;
}

// Export format for backup
export interface AppSettingsExport {
  version: string; // e.g., "1.0"
  exported_at: string; // ISO timestamp
  settings: Omit<AppSettings, 'id' | 'updated_at' | 'updated_by'>;
}
