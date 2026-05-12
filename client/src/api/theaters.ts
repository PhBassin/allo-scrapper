import apiClient, { getTenantScopedPath } from './client';
import type { ApiResponse } from '../types';
import type { Theater } from '../types';

// ============================================================================
// THEATER ADMIN TYPES
// ============================================================================

export interface TheaterCreate {
  /** Smart add: provide only a URL to auto-extract ID and scrape metadata */
  url?: string;
  /** Manual add: provide explicit ID and name */
  id?: string;
  name?: string;
}

export interface TheaterUpdate {
  name?: string;
  url?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  screen_count?: number;
}

// ============================================================================
// THEATERS API FUNCTIONS
// ============================================================================

/**
 * Get all theaters (public)
 */
export async function getTheaters(): Promise<Theater[]> {
  const response = await apiClient.get<ApiResponse<Theater[]>>(getTenantScopedPath('/theaters'));

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch theaters');
  }

  return response.data.data;
}

/**
 * Add a new theater (admin only).
 * Pass { url } for smart add (auto-scrape), or { id, name } for manual add.
 */
export async function createTheater(data: TheaterCreate): Promise<Theater> {
  const response = await apiClient.post<ApiResponse<Theater>>(getTenantScopedPath('/theaters'), data);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to create theater');
  }

  return response.data.data;
}

/**
 * Update a theater's name and/or URL (admin only).
 */
export async function updateTheater(id: string, data: TheaterUpdate): Promise<Theater> {
  const response = await apiClient.put<ApiResponse<Theater>>(`${getTenantScopedPath('/theaters')}/${id}`, data);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update theater');
  }

  return response.data.data;
}

/**
 * Delete a theater and all its showtimes (admin only).
 * Returns 204 No Content on success.
 */
export async function deleteTheater(id: string): Promise<void> {
  await apiClient.delete(`${getTenantScopedPath('/theaters')}/${id}`);
}

/**
 * Sync theaters from the database to the JSON config file (admin only).
 */
export async function syncTheaters(): Promise<void> {
  const response = await apiClient.post<ApiResponse<void>>(`${getTenantScopedPath('/theaters')}/sync`);

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to sync theaters');
  }
}
