import apiClient from './client';
import type { ApiResponse } from '../types';

// ============================================================================
// SERVER CONFIG TYPES
// ============================================================================

export interface ServerConfig {
  saasEnabled: boolean;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

export interface AppInfo {
  version: string;
  buildDate: string;
  environment: string;
  nodeVersion: string;
}

export interface ServerHealth {
  uptime: number;
  memoryUsage: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
  };
  platform: string;
  arch: string;
}

export interface DatabaseStats {
  size: string;
  tables: number;
  cinemas: number;
  films: number;
  showtimes: number;
}

export interface SystemInfo {
  app: AppInfo;
  server: ServerHealth;
  database: DatabaseStats;
}

export interface AppliedMigration {
  version: string;
  appliedAt: string;
  status: 'applied';
}

export interface PendingMigration {
  version: string;
  status: 'pending';
}

export interface MigrationsInfo {
  applied: AppliedMigration[];
  pending: PendingMigration[];
  total: number;
}

export interface ScraperStatus {
  activeJobs: number;
  lastScrapeTime: string | null;
  totalCinemas: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'error';
  checks: {
    database: boolean;
    migrations: boolean;
  };
  scrapers: ScraperStatus;
  uptime: number;
}

// ============================================================================
// SERVER CONFIG API
// ============================================================================

/**
 * Fetch runtime server configuration (public, no auth required).
 * Use this to read feature flags like saasEnabled instead of build-time Vite vars.
 */
export async function getServerConfig(): Promise<ServerConfig> {
  const response = await apiClient.get<ApiResponse<ServerConfig>>('/config');
  if (!response.data.success || !response.data.data) {
    throw new Error('Failed to fetch server config');
  }
  return response.data.data;
}

// ============================================================================
// SYSTEM API FUNCTIONS
// ============================================================================

/**
 * Get complete system information (admin only)
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const response = await apiClient.get<ApiResponse<SystemInfo>>('/system/info');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch system info');
  }
  return response.data.data;
}

/**
 * Get migrations information (admin only)
 */
export async function getMigrations(): Promise<MigrationsInfo> {
  const response = await apiClient.get<ApiResponse<MigrationsInfo>>('/system/migrations');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch migrations');
  }
  return response.data.data;
}

/**
 * Get system health status (admin only)
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const response = await apiClient.get<ApiResponse<SystemHealth>>('/system/health');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch system health');
  }
  return response.data.data;
}

/**
 * Format uptime in seconds to human-readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

// ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instance to prevent expensive
// object re-initialization during repeated calls or lists renders
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/**
 * Format date string to locale date/time
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return dateTimeFormatter.format(date);
}
