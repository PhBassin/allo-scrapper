import apiClient from './client';

export interface OrgInfo {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface RegisterOrgInput {
  orgName: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  firstCinemaUrl?: string;
}

export interface RegisterOrgResult {
  success: boolean;
  org: {
    id: string;
    name: string;
    slug: string;
    schema_name: string;
    status: string;
    trial_ends_at: string | null;
  };
}

export async function getOrgInfo(slug: string): Promise<OrgInfo> {
  const res = await apiClient.get<OrgInfo>(`/org/${slug}/ping`);
  return res.data;
}

export async function checkSlugAvailability(slug: string): Promise<boolean> {
  const res = await apiClient.get<{ available: boolean }>(`/orgs/${slug}/available`);
  return res.data.available;
}

export async function registerOrg(input: RegisterOrgInput): Promise<RegisterOrgResult> {
  const res = await apiClient.post<RegisterOrgResult>('/auth/register', input);
  return res.data;
}
