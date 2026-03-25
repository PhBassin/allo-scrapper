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

export interface ValidationConstraint {
  min: number;
  max: number;
  unit: string;
}

export type ValidationConstraints = Record<keyof RateLimitConfig, ValidationConstraint>;

// ============================================================================
// RATE LIMITS API FUNCTIONS
// ============================================================================

/**
 * Get current rate limit configuration
 */
export async function getRateLimits(): Promise<RateLimitConfigResponse> {
  const response = await apiClient.get<ApiResponse<RateLimitConfigResponse>>('/admin/rate-limits');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch rate limits');
  }
  return response.data.data;
}

/**
 * Update rate limit configuration
 */
export async function updateRateLimits(updates: Partial<RateLimitConfig>): Promise<RateLimitConfigResponse> {
  const response = await apiClient.put<ApiResponse<RateLimitConfigResponse>>('/admin/rate-limits', updates);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update rate limits');
  }
  return response.data.data;
}

/**
 * Reset rate limits to default values
 */
export async function resetRateLimits(): Promise<RateLimitConfigResponse> {
  const response = await apiClient.post<ApiResponse<RateLimitConfigResponse>>('/admin/rate-limits/reset');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to reset rate limits');
  }
  return response.data.data;
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
  
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch audit log');
  }
  return response.data.data;
}

/**
 * Get validation constraints for rate limit fields
 */
export async function getValidationConstraints(): Promise<ValidationConstraints> {
  const response = await apiClient.get<ApiResponse<ValidationConstraints>>('/admin/rate-limits/constraints');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch validation constraints');
  }
  return response.data.data;
}
