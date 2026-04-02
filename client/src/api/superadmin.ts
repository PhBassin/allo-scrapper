import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SuperadminDashboardData {
  orgs: Record<string, number>;
  new_orgs_this_week: number;
  mrr_cents: number;
  arr_cents: number;
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_id: number;
  plan_name: string;
  trial_ends_at: string | null;
  schema_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function getSuperadminDashboard(): Promise<SuperadminDashboardData> {
  const res = await apiClient.get<{ success: boolean; data: SuperadminDashboardData }>(
    '/superadmin/dashboard',
  );
  return res.data.data;
}

export async function getSuperadminOrgs(params?: {
  status?: string;
  search?: string;
}): Promise<OrgRow[]> {
  const res = await apiClient.get<{ success: boolean; data: OrgRow[] }>('/superadmin/orgs', {
    params,
  });
  return res.data.data;
}

export async function getSuperadminAuditLog(params?: {
  page?: number;
  limit?: number;
}): Promise<AuditLogResponse> {
  const res = await apiClient.get<{ success: boolean } & AuditLogResponse>('/superadmin/audit-log', {
    params,
  });
  const { success: _success, ...rest } = res.data;
  return rest as AuditLogResponse;
}

export async function impersonateOrg(org_slug: string): Promise<{ token: string }> {
  const res = await apiClient.post<{ success: boolean; token: string }>(
    '/superadmin/impersonate',
    { org_slug },
  );
  return { token: res.data.token };
}

export async function suspendOrg(orgId: string, reason?: string): Promise<OrgRow> {
  const res = await apiClient.post<{ success: boolean; data: OrgRow }>(
    `/superadmin/orgs/${orgId}/suspend`,
    { reason },
  );
  return res.data.data;
}

export async function reactivateOrg(orgId: string): Promise<OrgRow> {
  const res = await apiClient.post<{ success: boolean; data: OrgRow }>(
    `/superadmin/orgs/${orgId}/reactivate`,
  );
  return res.data.data;
}

export async function resetOrgTrial(orgId: string): Promise<OrgRow> {
  const res = await apiClient.post<{ success: boolean; data: OrgRow }>(
    `/superadmin/orgs/${orgId}/reset-trial`,
  );
  return res.data.data;
}
