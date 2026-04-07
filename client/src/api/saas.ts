import apiClient from './client';
import type { ApiResponse } from '../types';

// ============================================================================
// SAAS CONFIG TYPES
// ============================================================================

export interface AppConfig {
  saasEnabled: boolean;
  appName: string;
}

export interface RegisterOrgPayload {
  orgName: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
}

export interface RegisterOrgResult {
  token: string;
  admin: {
    id: number;
    username: string;
    role_id: number;
    role_name: string;
  };
  org: {
    id: number;
    name: string;
    slug: string;
    schema_name: string;
    status: string;
    trial_ends_at: string | null;
  };
}

export interface OrgPingResult {
  org: {
    id: number;
    slug: string;
    name: string;
    status: string;
  };
}

// ============================================================================
// SAAS API FUNCTIONS
// ============================================================================

/**
 * Fetch public runtime configuration.
 * No authentication required.
 */
export async function getConfig(): Promise<AppConfig> {
  const response = await apiClient.get<ApiResponse<AppConfig>>('/config');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch config');
  }
  return response.data.data;
}

/**
 * Register a new organization.
 * POST /api/saas/orgs
 */
export async function registerOrg(payload: RegisterOrgPayload): Promise<RegisterOrgResult> {
  const response = await apiClient.post<RegisterOrgResult & { success: boolean }>(
    '/saas/orgs',
    payload
  );
  if (!response.data.success) {
    throw new Error('Registration failed');
  }
  return response.data;
}

/**
 * Check whether a slug is available.
 * GET /api/saas/orgs/:slug/available
 */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  const response = await apiClient.get<{ success: boolean; available: boolean }>(
    `/saas/orgs/${encodeURIComponent(slug)}/available`
  );
  return response.data.available === true;
}

/**
 * Ping an org to verify it exists and is reachable.
 * GET /api/org/:slug/ping
 */
export async function pingOrg(slug: string): Promise<OrgPingResult> {
  const response = await apiClient.get<{ success: boolean } & OrgPingResult>(
    `/org/${encodeURIComponent(slug)}/ping`
  );
  if (!response.data.success) {
    throw new Error('Organization not found');
  }
  return { org: response.data.org };
}
