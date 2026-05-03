/**
 * Minimal DB interfaces for the SaaS package.
 * Compatible with the server's pg.Pool-backed db wrapper.
 */

export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

/** Thin query wrapper (matches server/src/db/client.ts `db` object) */
export interface DB {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/** pg.Pool interface for acquiring dedicated clients (tenant middleware) */
export interface Pool {
  connect(): Promise<PoolClient>;
}

export interface PoolClient extends DB {
  release(err?: Error): void;
}

/** A row from public.organizations */
export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan_id: number;
  schema_name: string;
  status: 'trial' | 'active' | 'suspended' | 'canceled';
  trial_ends_at: string | null;
  created_at?: string;
  updated_at?: string;
}

/** A row from public.plans */
export interface Plan {
  id: number;
  name: string;
  max_cinemas: number;
  max_users: number;
  max_scrapes_per_day: number;
}

/** Input for inserting a new org */
export interface InsertOrgInput {
  name: string;
  slug: string;
  plan_id?: number;
}

/** Input for minting a JWT */
export interface MintJwtInput {
  userId: number;
  username: string;
  orgId: number;
  orgSlug: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}

/** A user row within an org schema */
export interface OrgUser {
  id: number;
  username: string;
  password_hash: string | null;
  role_id: number;
  role_name?: string;
  email_verified: boolean;
  verification_token: string | null;
  verification_expires: string | null;
  created_at: string;
  updated_at: string;
}

/** A row from the org-schema invitations table */
export interface Invitation {
  id: string;
  email: string;
  role_id: number;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_by: number | null;
  created_at: string;
}

/** Footer link for org settings */
export interface FooterLink {
  label: string;
  text?: string;
  url: string;
}

/** Scrape mode options */
export type ScrapeMode = 'weekly' | 'from_today' | 'from_today_limited';

/** Full org settings row from tenant app_settings table */
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

/** Public org settings (excludes sensitive fields) */
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
  scrape_mode: ScrapeMode;
  scrape_days: number;
}

/** Partial update input for org settings */
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
