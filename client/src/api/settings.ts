import apiClient, { getTenantScopedPath } from './client';
import type { ApiResponse } from '../types';

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export type ScrapeMode = 'weekly' | 'from_today' | 'from_today_limited';

export interface FooterLink {
  label: string;
  text?: string;
  url: string;
}

interface ServerThemeShape {
  color_surface?: string;
  color_text_primary?: string;
  font_primary?: string;
  font_secondary?: string;
}

interface LegacyThemeShape {
  color_text?: string;
  color_border?: string;
  font_family_heading?: string;
  font_family_body?: string;
}

interface ServerAppSettingsUpdate {
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
  font_primary?: string;
  font_secondary?: string;
  footer_text?: string | null;
  footer_links?: FooterLink[];
  email_from_name?: string;
  email_from_address?: string;
  email_logo_base64?: string | null;
  scrape_mode?: ScrapeMode;
  scrape_days?: number;
}

export interface AppSettingsPublic {
  site_name: string;
  logo_base64: string | null;
  favicon_base64: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_text: string;
  color_text_secondary: string;
  color_border: string;
  color_success: string;
  color_error: string;
  font_family_heading: string;
  font_family_body: string;
  footer_text: string | null;
  footer_links: FooterLink[];
}

export interface AppSettings extends AppSettingsPublic {
  id: number;
  email_from_name: string;
  email_from_address: string;
  email_logo_base64: string | null;
  scrape_mode: ScrapeMode;
  scrape_days: number;
  updated_at: string;
  updated_by: string | number | null;
}

export interface AppSettingsUpdate {
  site_name?: string;
  logo_base64?: string | null;
  favicon_base64?: string | null;
  color_primary?: string;
  color_secondary?: string;
  color_accent?: string;
  color_background?: string;
  color_text?: string;
  color_text_secondary?: string;
  color_border?: string;
  color_success?: string;
  color_error?: string;
  font_family_heading?: string;
  font_family_body?: string;
  footer_text?: string | null;
  footer_links?: FooterLink[];
  email_from_name?: string;
  email_from_address?: string;
  email_logo_base64?: string | null;
  scrape_mode?: ScrapeMode;
  scrape_days?: number;
}

export interface AppSettingsExport {
  version: string;
  exported_at: string;
  exported_by: string;
  settings: AppSettings;
}

function normalizeFooterLinks(footerLinks: FooterLink[] | undefined): FooterLink[] {
  if (!Array.isArray(footerLinks)) {
    return [];
  }

  return footerLinks.map((link) => ({
    label: link.label ?? link.text ?? '',
    text: link.text ?? link.label ?? '',
    url: link.url ?? '',
  }));
}

function normalizeSettingsResponse<T extends Partial<AppSettingsPublic> & ServerThemeShape & LegacyThemeShape & { footer_links?: FooterLink[] }>(
  settings: T
): T & AppSettingsPublic {
  const colorText = settings.color_text || settings.color_text_primary || '#111827';
  const colorTextSecondary = settings.color_text_secondary || '#6B7280';
  const colorBorder = settings.color_border || settings.color_surface || '#E5E7EB';
  const fontHeading = settings.font_family_heading || settings.font_primary || 'Inter';
  const fontBody = settings.font_family_body || settings.font_secondary || 'Inter';

  return {
    ...settings,
    color_text: colorText,
    color_text_secondary: colorTextSecondary,
    color_border: colorBorder,
    font_family_heading: fontHeading,
    font_family_body: fontBody,
    footer_links: normalizeFooterLinks(settings.footer_links),
  } as T & AppSettingsPublic;
}

function normalizeSettingsExport(data: AppSettingsExport): AppSettingsExport {
  return {
    ...data,
    settings: normalizeSettingsResponse(data.settings),
  };
}

function toServerSettingsUpdate(updates: AppSettingsUpdate): ServerAppSettingsUpdate {
  const {
    color_text,
    color_border,
    font_family_heading,
    font_family_body,
    ...rest
  } = updates;

  const normalized: ServerAppSettingsUpdate = {
    ...rest,
  };

  if (rest.footer_links !== undefined) {
    normalized.footer_links = normalizeFooterLinks(rest.footer_links);
  }

  if (color_text !== undefined) {
    normalized.color_text_primary = color_text;
  }

  if (color_border !== undefined) {
    normalized.color_surface = color_border;
  }

  if (font_family_heading !== undefined) {
    normalized.font_primary = font_family_heading;
  }

  if (font_family_body !== undefined) {
    normalized.font_secondary = font_family_body;
  }

  return normalized;
}

function getSettingsBasePath(): string {
  return getTenantScopedPath('/settings');
}

function getAdminSettingsPath(): string {
  return `${getTenantScopedPath('/settings')}/admin`;
}

function isTenantScopedSettingsRoute(): boolean {
  return getSettingsBasePath() !== '/settings';
}

function determineSettingsWritePath(): string {
  return isTenantScopedSettingsRoute()
    ? getAdminSettingsPath()
    : getSettingsBasePath();
}

function determineSettingsResetPath(): string {
  return isTenantScopedSettingsRoute()
    ? `${getAdminSettingsPath()}/reset`
    : `${getSettingsBasePath()}/reset`;
}

function getSettingsExportPath(): string {
  return `${getTenantScopedPath('/settings')}/export`;
}

function getSettingsImportPath(): string {
  return `${getTenantScopedPath('/settings')}/import`;
}

// ============================================================================
// SETTINGS API FUNCTIONS
// ============================================================================

/**
 * Get public settings (no authentication required)
 */
export async function getPublicSettings(): Promise<AppSettingsPublic> {
  const response = await apiClient.get<ApiResponse<AppSettingsPublic>>(getSettingsBasePath());
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch public settings');
  }
  return normalizeSettingsResponse(response.data.data);
}

/**
 * Get full settings (admin only)
 */
export async function getAdminSettings(): Promise<AppSettings> {
  const response = await apiClient.get<ApiResponse<AppSettings>>(getAdminSettingsPath());
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch admin settings');
  }
  return normalizeSettingsResponse(response.data.data);
}

/**
 * Update settings (admin only)
 */
export async function updateSettings(updates: AppSettingsUpdate): Promise<AppSettings> {
  const response = await apiClient.put<ApiResponse<AppSettings>>(determineSettingsWritePath(), toServerSettingsUpdate(updates));
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update settings');
  }
  return normalizeSettingsResponse(response.data.data);
}

/**
 * Reset settings to defaults (admin only)
 */
export async function resetSettings(): Promise<AppSettings> {
  const response = await apiClient.post<ApiResponse<AppSettings>>(determineSettingsResetPath());
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to reset settings');
  }
  return normalizeSettingsResponse(response.data.data);
}

/**
 * Export settings as JSON backup (admin only)
 */
export async function exportSettings(): Promise<AppSettingsExport> {
  const response = await apiClient.post<ApiResponse<AppSettingsExport>>(getSettingsExportPath());
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to export settings');
  }
  return normalizeSettingsExport(response.data.data);
}

/**
 * Import settings from JSON backup (admin only)
 */
export async function importSettings(data: AppSettingsExport): Promise<AppSettings> {
  const normalizedPayload = normalizeSettingsExport(data);
  const response = await apiClient.post<ApiResponse<AppSettings>>(getSettingsImportPath(), normalizedPayload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to import settings');
  }
  return normalizeSettingsResponse(response.data.data);
}

/**
 * Download settings export as JSON file
 */
export async function downloadSettingsExport(): Promise<void> {
  const exportData = await exportSettings();
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `app-settings-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Upload and import settings from a JSON file
 */
export async function uploadSettingsImport(file: File): Promise<AppSettings> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as AppSettingsExport;
        const result = await importSettings(data);
        resolve(result);
      } catch {
        reject(new Error('Invalid settings file format'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}
