import apiClient from './core';
import type { ApiResponse, ScrapeReport, PaginatedResponse } from '../types';

export interface ScrapeAttempt {
  id: number;
  report_id: number;
  theater_id: string;
  date: string;
  status: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted';
  error_type?: string | null;
  error_message?: string | null;
  http_status_code?: number | null;
  movies_scraped: number;
  showtimes_scraped: number;
  attempted_at: string;
}

export interface ReportDetails {
  report: ScrapeReport;
  attempts: Record<string, ScrapeAttempt[]>;
  summary: {
    total_attempts: number;
    successful: number;
    failed: number;
    rate_limited: number;
    not_attempted: number;
    pending: number;
  };
}

export async function getScrapeReports(params?: {
  page?: number;
  pageSize?: number;
  status?: 'running' | 'success' | 'partial_success' | 'failed';
  triggerType?: 'manual' | 'cron';
}): Promise<PaginatedResponse<ScrapeReport>> {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<ScrapeReport>>>('/reports', params as Record<string, string | number>);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch reports');
  }
  return response.data;
}

export async function getScrapeReportById(id: number): Promise<ScrapeReport> {
  const response = await apiClient.get<ApiResponse<ScrapeReport>>(`/reports/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch report');
  }
  return response.data;
}

export async function getReportDetails(id: number): Promise<ReportDetails> {
  const response = await apiClient.get<ApiResponse<ReportDetails>>(`/reports/${id}/details`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch report details');
  }
  return response.data;
}

export async function resumeScrape(reportId: number): Promise<{ reportId: number; parentReportId: number; pendingAttempts: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; parentReportId: number; pendingAttempts: number; message: string }>>(`/scraper/resume/${reportId}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to resume scrape');
  }
  return response.data;
}
