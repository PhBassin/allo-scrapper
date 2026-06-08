import apiClient from './core';
import type { ApiResponse, ScrapeStatus, ProgressEvent } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function triggerScrape(): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to trigger scrape');
  }
  return response.data;
}

export async function triggerTheaterScrape(theaterId: string): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger', {
    theaterId,
  });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to trigger theater scrape');
  }
  return response.data;
}

export async function getScrapeStatus(): Promise<ScrapeStatus> {
  const response = await apiClient.get<ApiResponse<ScrapeStatus>>('/scraper/status');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch scrape status');
  }
  return response.data;
}

export function subscribeToProgress(onEvent: (event: ProgressEvent) => void, onError?: (error: Error) => void): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/scraper/progress`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (error) {
      console.error('Failed to parse SSE event:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (onError) {
      onError(new Error('Connection lost'));
    }
  };

  return () => {
    eventSource.close();
  };
}
