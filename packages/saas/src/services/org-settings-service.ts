import type { PoolClient } from '../db/types.js';

// ── Types (mirroring server/src/types/settings.ts) ────────────────────────────

export type ScrapeMode = 'weekly' | 'from_today' | 'from_today_limited';

export interface FooterLink {
  label: string;
  url: string;
}

export interface OrgSettings {
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
  footer_links: FooterLink[];
  email_from_name: string;
  email_from_address: string;
  scrape_mode: ScrapeMode;
  scrape_days: number;
  updated_at: string;
  updated_by: number | null;
}

export interface OrgSettingsPublic {
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
  footer_links: FooterLink[];
}

export interface OrgSettingsUpdate {
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
  scrape_mode?: ScrapeMode;
  scrape_days?: number;
}

export interface OrgSettingsExport {
  version: string;
  exported_at: string;
  settings: Omit<OrgSettings, 'id' | 'updated_at' | 'updated_by'>;
}

// ── DB row interface ──────────────────────────────────────────────────────────

interface OrgSettingsRow {
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
  footer_links: string | FooterLink[];
  email_from_name: string;
  email_from_address: string;
  scrape_mode: string;
  scrape_days: number;
  updated_at: string;
  updated_by: number | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function rowToSettings(row: OrgSettingsRow): OrgSettings {
  return {
    ...row,
    footer_links:
      typeof row.footer_links === 'string'
        ? (JSON.parse(row.footer_links) as FooterLink[])
        : row.footer_links,
    scrape_mode: row.scrape_mode as ScrapeMode,
  };
}

function toPublicSettings(settings: OrgSettings): OrgSettingsPublic {
  const {
    id: _id,
    email_from_name: _efn,
    email_from_address: _efa,
    updated_at: _uat,
    updated_by: _uby,
    scrape_mode: _sm,
    scrape_days: _sd,
    ...publicFields
  } = settings;
  return publicFields;
}

// ── Field map (same columns as app_settings) ──────────────────────────────────

const FIELD_MAP: Record<keyof OrgSettingsUpdate, string> = {
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

const REQUIRED_IMPORT_FIELDS: (keyof OrgSettingsUpdate)[] = [
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

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Per-tenant settings service.
 * Operates on the `org_settings` table inside the org's schema.
 * Accepts a `PoolClient` whose `search_path` is already scoped to the org
 * schema by the `resolveTenant` middleware.
 */
export class OrgSettingsService {
  constructor(private readonly client: PoolClient) {}

  /**
   * Get full settings (admin only).
   */
  async getSettings(): Promise<OrgSettings | undefined> {
    const result = await this.client.query<OrgSettingsRow>(
      'SELECT * FROM org_settings WHERE id = 1',
    );
    if (result.rows.length === 0) return undefined;
    return rowToSettings(result.rows[0]);
  }

  /**
   * Get public settings (no authentication required).
   */
  async getPublicSettings(): Promise<OrgSettingsPublic | undefined> {
    const settings = await this.getSettings();
    if (!settings) return undefined;
    return toPublicSettings(settings);
  }

  /**
   * Update settings fields.
   */
  async updateSettings(
    updates: OrgSettingsUpdate,
    userId: number,
  ): Promise<OrgSettings | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, dbColumn] of Object.entries(FIELD_MAP)) {
      if (key in updates) {
        const value = updates[key as keyof OrgSettingsUpdate];
        if (key === 'footer_links') {
          fields.push(`${dbColumn} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${dbColumn} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${paramIndex}`);
    values.push(userId);

    const query = `
      UPDATE org_settings
      SET ${fields.join(', ')}
      WHERE id = 1
      RETURNING *
    `;

    const result = await this.client.query<OrgSettingsRow>(query, values);
    if (result.rows.length === 0) return undefined;
    return rowToSettings(result.rows[0]);
  }

  /**
   * Reset to default values.
   */
  async resetSettings(userId: number): Promise<OrgSettings | undefined> {
    const query = `
      UPDATE org_settings
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

    const result = await this.client.query<OrgSettingsRow>(query, [userId]);
    if (result.rows.length === 0) return undefined;
    return rowToSettings(result.rows[0]);
  }

  /**
   * Export settings for backup.
   */
  async exportSettings(): Promise<OrgSettingsExport | undefined> {
    const settings = await this.getSettings();
    if (!settings) return undefined;

    const { id: _id, updated_at: _uat, updated_by: _uby, ...exportable } = settings;

    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      settings: exportable,
    };
  }

  /**
   * Import settings from a backup.
   * @throws Error if version is incompatible or required fields are missing.
   */
  async importSettings(
    exportData: OrgSettingsExport,
    userId: number,
  ): Promise<OrgSettings | undefined> {
    if (exportData.version !== '1.0') {
      throw new Error(
        `Incompatible version: ${exportData.version}. Expected 1.0`,
      );
    }

    for (const field of REQUIRED_IMPORT_FIELDS) {
      if (!(field in exportData.settings)) {
        throw new Error(`Missing required field in import data: ${field}`);
      }
    }

    return this.updateSettings(exportData.settings as OrgSettingsUpdate, userId);
  }
}
