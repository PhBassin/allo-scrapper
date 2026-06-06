import apiClient from './client';
import type { ApiResponse } from '../types';

// ============================================================================
// RATE LIMITS TYPES
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  generalMax: number;
  authMax: number;
  registerMax: number;
  registerWindowMs: number;
  protectedMax: number;
  scraperMax: number;
  publicMax: number;
  healthMax: number;
  healthWindowMs: number;
}

export interface RateLimitConfigResponse {
  config: RateLimitConfig;
  source: 'database' | 'env' | 'default';
  updatedAt: string | null;
  updatedBy: { id: number; username: string } | null;
  environment: string;
  message?: string;
}

export interface RateLimitAuditLogEntry {
  id: number;
  changed_at: string;
  changed_by: number;
  changed_by_username: string;
  changed_by_role: string;
  field_name: string;
  old_value: string;
  new_value: string;
  user_ip: string | null;
  user_agent: string | null;
}

export interface RateLimitAuditLog {
  logs: RateLimitAuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// RATE LIMITS API FUNCTIONS
// ============================================================================

/**
 * Get current rate limit configuration
 */
export async function getRateLimits(): Promise<RateLimitConfigResponse> {
  const response = await apiClient.get<ApiResponse<RateLimitConfigResponse>>('/admin/rate-limits');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch rate limits');
  }
  return response.data;
}

/**
 * Update rate limit configuration
 */
export async function updateRateLimits(updates: Partial<RateLimitConfig>): Promise<RateLimitConfigResponse> {
  const response = await apiClient.put<ApiResponse<RateLimitConfigResponse>>('/admin/rate-limits', updates);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update rate limits');
  }
  return response.data;
}

/**
 * Reset rate limits to default values
 */
export async function resetRateLimits(): Promise<RateLimitConfigResponse> {
  const response = await apiClient.post<ApiResponse<RateLimitConfigResponse>>('/admin/rate-limits/reset');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to reset rate limits');
  }
  return response.data;
}

/**
 * Get rate limit audit log
 */
export async function getRateLimitAuditLog(params?: {
  limit?: number;
  offset?: number;
  userId?: number;
}): Promise<RateLimitAuditLog> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.userId) queryParams.append('userId', params.userId.toString());

  const url = `/admin/rate-limits/audit${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<ApiResponse<RateLimitAuditLog>>(url);
  
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch audit log');
  }
  return response.data;
}
