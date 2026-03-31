import { type DB } from './client.js';
import type {
  AppSettings,
  AppSettingsPublic,
  AppSettingsUpdate,
  AppSettingsExport,
  FooterLink,
  ScrapeMode,
} from '../types/settings.js';
import { logger } from '../utils/logger.js';

// Database row interface for app_settings table
export interface AppSettingsRow {
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
  font_primary: string;
  font_secondary: string;
  footer_text: string | null;
  footer_links: string | FooterLink[]; // JSON string or JSONB object
  email_from_name: string;
  email_from_address: string;
  scrape_mode: string;
  scrape_days: number;
  updated_at: string;
  updated_by: number | null;
}

// Convert database row to AppSettings type
function rowToSettings(row: AppSettingsRow): AppSettings {
  return {
    ...row,
    // Handle both JSONB (already parsed) and TEXT (need to parse)
    footer_links: typeof row.footer_links === 'string' 
      ? JSON.parse(row.footer_links) as FooterLink[]
      : row.footer_links,
    scrape_mode: row.scrape_mode as ScrapeMode,
  };
}

// Convert AppSettings to public version (remove sensitive fields)
function toPublicSettings(settings: AppSettings): AppSettingsPublic {
  const {
    id,
    email_from_name,
    email_from_address,
    updated_at,
    updated_by,
    ...publicFields
  } = settings;
  
  return publicFields;
}

/**
 * Get full settings (admin only)
 */
export async function getSettings(db: DB): Promise<AppSettings | undefined> {
  const result = await db.query<AppSettingsRow>('SELECT * FROM app_settings WHERE id = 1');
  
  if (result.rows.length === 0) {
    return undefined;
  }

  return rowToSettings(result.rows[0]);
}

/**
 * Get public settings (for unauthenticated users and frontend theming)
 */
export async function getPublicSettings(db: DB): Promise<AppSettingsPublic | undefined> {
  const settings = await getSettings(db);
  
  if (!settings) {
    return undefined;
  }

  return toPublicSettings(settings);
}

/**
 * Update settings (admin only)
 * @param db - Database connection
 * @param updates - Partial settings to update
 * @param userId - ID of the user making the update
 */
export async function updateSettings(
  db: DB,
  updates: AppSettingsUpdate,
  userId: number
): Promise<AppSettings | undefined> {
  // Build dynamic UPDATE query
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Map of update fields to database columns
  const fieldMap: Record<keyof AppSettingsUpdate, string> = {
    site_name: 'site_name',
    logo_base64: 'logo_base64',
    favicon_base64: 'favicon_base64',
    color_primary: 'color_primary',
    color_secondary: 'color_secondary',
    color_accent: 'color_accent',
    color_background: 'color_background',
    color_surface: 'color_surface',
    color_text_primary: 'color_text_primary',
    color_text_secondary: 'color_text_secondary',
    color_success: 'color_success',
    color_error: 'color_error',
    font_primary: 'font_primary',
    font_secondary: 'font_secondary',
    footer_text: 'footer_text',
    footer_links: 'footer_links',
    email_from_name: 'email_from_name',
    email_from_address: 'email_from_address',
    scrape_mode: 'scrape_mode',
    scrape_days: 'scrape_days',
  };

  for (const [key, dbColumn] of Object.entries(fieldMap)) {
    if (key in updates) {
      const value = updates[key as keyof AppSettingsUpdate];
      
      // Special handling for footer_links (JSONB type - need to stringify and cast)
      if (key === 'footer_links') {
        fields.push(`${dbColumn} = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(value));
        paramIndex++;
      } else {
        fields.push(`${dbColumn} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
  }

  // Always update updated_at and updated_by
  fields.push(`updated_at = NOW()`);
  fields.push(`updated_by = $${paramIndex}`);
  values.push(userId);

  // If no fields to update, still update the timestamp
  if (fields.length === 2) { // Only updated_at and updated_by
    logger.warn('updateSettings called with empty updates object');
  }

  const query = `
    UPDATE app_settings
    SET ${fields.join(', ')}
    WHERE id = 1
    RETURNING *
  `;

  const result = await db.query<AppSettingsRow>(query, values);

  if (result.rows.length === 0) {
    return undefined;
  }

  return rowToSettings(result.rows[0]);
}

/**
 * Reset settings to default values (admin only)
 */
export async function resetSettings(db: DB, userId: number): Promise<AppSettings | undefined> {
  const query = `
    UPDATE app_settings
    SET 
      site_name = 'Allo-Scrapper',
      logo_base64 = NULL,
      favicon_base64 = NULL,
      color_primary = '#FECC00',
      color_secondary = '#1F2937',
      color_accent = '#F59E0B',
      color_background = '#FFFFFF',
      color_surface = '#F3F4F6',
      color_text_primary = '#111827',
      color_text_secondary = '#6B7280',
      color_success = '#10B981',
      color_error = '#EF4444',
      font_primary = 'Inter',
      font_secondary = 'Roboto',
      footer_text = NULL,
      footer_links = '[]'::jsonb,
      email_from_name = 'Allo-Scrapper',
      email_from_address = 'no-reply@allocine-scrapper.com',
      scrape_mode = 'weekly',
      scrape_days = 7,
      updated_at = NOW(),
      updated_by = $1
    WHERE id = 1
    RETURNING *
  `;

  const result = await db.query<AppSettingsRow>(query, [userId]);

  if (result.rows.length === 0) {
    return undefined;
  }

  return rowToSettings(result.rows[0]);
}

/**
 * Export settings to JSON (for backup/migration)
 */
export async function exportSettings(db: DB): Promise<AppSettingsExport | undefined> {
  const settings = await getSettings(db);

  if (!settings) {
    return undefined;
  }

  // Exclude id, updated_at, updated_by from export
  const { id, updated_at, updated_by, ...exportableSettings } = settings;

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    settings: exportableSettings,
  };
}

/**
 * Import settings from JSON export (admin only)
 * @throws Error if version is incompatible or data is invalid
 */
export async function importSettings(
  db: DB,
  exportData: AppSettingsExport,
  userId: number
): Promise<AppSettings | undefined> {
  // Validate version
  if (exportData.version !== '1.0') {
    throw new Error(`Incompatible version: ${exportData.version}. Expected 1.0`);
  }

  // Validate required fields
  const requiredFields: (keyof typeof exportData.settings)[] = [
    'site_name',
    'color_primary',
    'color_secondary',
    'color_accent',
    'color_background',
    'color_surface',
    'color_text_primary',
    'color_text_secondary',
    'color_success',
    'color_error',
    'font_primary',
    'font_secondary',
    'email_from_name',
    'email_from_address',
  ];

  for (const field of requiredFields) {
    if (!(field in exportData.settings)) {
      throw new Error(`Missing required field in import data: ${field}`);
    }
  }

  // Use updateSettings to apply the imported data
  return updateSettings(db, exportData.settings as AppSettingsUpdate, userId);
}
