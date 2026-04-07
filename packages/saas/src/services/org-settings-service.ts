/**
 * Service for managing per-org white-label settings.
 * Each org has its own org_settings table in its schema (org_<slug>).
 * 
 * This is the SaaS equivalent of server/src/db/settings-queries.ts,
 * but operates on org-scoped settings instead of global app settings.
 */

import type { DB } from '../db/types.js';
import type {
  OrgSettings,
  OrgSettingsPublic,
  OrgSettingsUpdate,
  FooterLink,
  ScrapeMode,
} from '../db/types.js';

// Database row interface for org_settings table
export interface OrgSettingsRow {
  id: number;
  site_name: string;
  logo_base64: string | null;
  favicon_base64: string | null;
  color_primary: string;
  color_secondary: string;
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

export class OrgSettingsService {
  constructor(private db: DB) {}

  /**
   * Convert database row to OrgSettings type
   */
  private rowToSettings(row: OrgSettingsRow): OrgSettings {
    return {
      ...row,
      // Handle both JSONB (already parsed) and TEXT (need to parse)
      footer_links: typeof row.footer_links === 'string'
        ? JSON.parse(row.footer_links) as FooterLink[]
        : row.footer_links,
      scrape_mode: row.scrape_mode as ScrapeMode,
    };
  }

  /**
   * Convert OrgSettings to public version (remove sensitive fields)
   */
  private toPublicSettings(settings: OrgSettings): OrgSettingsPublic {
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
  async getSettings(): Promise<OrgSettings | undefined> {
    const result = await this.db.query<OrgSettingsRow>(
      'SELECT * FROM org_settings WHERE id = 1'
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.rowToSettings(result.rows[0]);
  }

  /**
   * Get public settings (for unauthenticated users and frontend theming)
   */
  async getPublicSettings(): Promise<OrgSettingsPublic | undefined> {
    const settings = await this.getSettings();

    if (!settings) {
      return undefined;
    }

    return this.toPublicSettings(settings);
  }

  /**
   * Update settings (admin only)
   * @param updates - Partial settings to update
   * @param userId - ID of the user making the update
   */
  async updateSettings(
    updates: OrgSettingsUpdate,
    userId: number
  ): Promise<OrgSettings | undefined> {
    // Build dynamic UPDATE query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Map of update fields to database columns
    const fieldMap: Record<keyof OrgSettingsUpdate, string> = {
      site_name: 'site_name',
      logo_base64: 'logo_base64',
      favicon_base64: 'favicon_base64',
      color_primary: 'color_primary',
      color_secondary: 'color_secondary',
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
        const value = updates[key as keyof OrgSettingsUpdate];

        // Special handling for footer_links (JSONB type)
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

    const query = `
      UPDATE org_settings
      SET ${fields.join(', ')}
      WHERE id = 1
      RETURNING *
    `;

    const result = await this.db.query<OrgSettingsRow>(query, values);

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.rowToSettings(result.rows[0]);
  }

  /**
   * Reset settings to default values (admin only)
   */
  async resetSettings(userId: number): Promise<OrgSettings | undefined> {
    const query = `
      UPDATE org_settings
      SET 
        site_name = 'My Cinema',
        logo_base64 = NULL,
        favicon_base64 = NULL,
        color_primary = '#FECC00',
        color_secondary = '#1F2937',
        font_primary = 'Inter',
        font_secondary = 'Roboto',
        footer_text = NULL,
        footer_links = '[]'::jsonb,
        email_from_name = 'Cinema Team',
        email_from_address = 'no-reply@example.com',
        scrape_mode = 'weekly',
        scrape_days = 7,
        updated_at = NOW(),
        updated_by = $1
      WHERE id = 1
      RETURNING *
    `;

    const result = await this.db.query<OrgSettingsRow>(query, [userId]);

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.rowToSettings(result.rows[0]);
  }
}
