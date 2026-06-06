import apiClient from './core';
import type { ApiResponse, ScrapeSchedule } from '../types';

export interface CreateSchedulePayload {
  name: string;
  description?: string | null;
  cron_expression: string;
  enabled?: boolean;
  target_theaters?: string[] | null;
}

export interface UpdateSchedulePayload {
  name?: string;
  description?: string | null;
  cron_expression?: string;
  enabled?: boolean;
  target_theaters?: string[] | null;
}

export async function getSchedules(): Promise<ScrapeSchedule[]> {
  const response = await apiClient.get<ApiResponse<ScrapeSchedule[]>>('/scraper/schedules');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch schedules');
  }
  return response.data;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<ScrapeSchedule> {
  const response = await apiClient.post<ApiResponse<ScrapeSchedule>>('/scraper/schedules', payload);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to create schedule');
  }
  return response.data;
}

export async function updateSchedule(id: number, payload: UpdateSchedulePayload): Promise<ScrapeSchedule> {
  const response = await apiClient.put<ApiResponse<ScrapeSchedule>>(`/scraper/schedules/${id}`, payload);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update schedule');
  }
  return response.data;
}

export async function deleteSchedule(id: number): Promise<void> {
  await apiClient.delete(`/scraper/schedules/${id}`);
}
