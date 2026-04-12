import apiClient from './client';
import type { ApiResponse } from '../types';

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export type ScrapeMode = 'weekly' | 'from_today' | 'from_today_limited';

export interface FooterLink {
  label: string;
  url: string;
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
  updated_by: string | null;
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

// ============================================================================
// SETTINGS API FUNCTIONS
// ============================================================================

/**
 * Get public settings (no authentication required)
 */
export async function getPublicSettings(orgSlug?: string): Promise<AppSettingsPublic> {
  const url = orgSlug ? `/org/${orgSlug}/settings` : '/settings';
  const response = await apiClient.get<ApiResponse<AppSettingsPublic>>(url);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch public settings');
  }
  return response.data.data;
}

/**
 * Get full settings (admin only)
 */
export async function getAdminSettings(orgSlug?: string): Promise<AppSettings> {
  const url = orgSlug ? `/org/${orgSlug}/settings/admin` : '/settings/admin';
  const response = await apiClient.get<ApiResponse<AppSettings>>(url);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch admin settings');
  }
  return response.data.data;
}

/**
 * Update settings (admin only)
 */
export async function updateSettings(updates: AppSettingsUpdate, orgSlug?: string): Promise<AppSettings> {
  const url = orgSlug ? `/org/${orgSlug}/settings/admin` : '/settings';
  const response = await apiClient.put<ApiResponse<AppSettings>>(url, updates);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update settings');
  }
  return response.data.data;
}

/**
 * Reset settings to defaults (admin only)
 */
export async function resetSettings(): Promise<AppSettings> {
  const response = await apiClient.post<ApiResponse<AppSettings>>('/settings/reset');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to reset settings');
  }
  return response.data.data;
}

/**
 * Export settings as JSON backup (admin only)
 */
export async function exportSettings(): Promise<AppSettingsExport> {
  const response = await apiClient.post<ApiResponse<AppSettingsExport>>('/settings/export');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to export settings');
  }
  return response.data.data;
}

/**
 * Import settings from JSON backup (admin only)
 */
export async function importSettings(data: AppSettingsExport): Promise<AppSettings> {
  const response = await apiClient.post<ApiResponse<AppSettings>>('/settings/import', data);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to import settings');
  }
  return response.data.data;
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
