import apiClient from './client';
import type { ApiResponse } from '../types';
import type { Cinema } from '../types';

// ============================================================================
// CINEMA ADMIN TYPES
// ============================================================================

export interface CinemaCreate {
  /** Smart add: provide only a URL to auto-extract ID and scrape metadata */
  url?: string;
  /** Manual add: provide explicit ID and name */
  id?: string;
  name?: string;
}

export interface CinemaUpdate {
  name?: string;
  url?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  screen_count?: number;
}

// ============================================================================
// CINEMAS API FUNCTIONS
// ============================================================================

/**
 * Get all cinemas (public)
 */
export async function getCinemas(): Promise<Cinema[]> {
  const response = await apiClient.get<ApiResponse<Cinema[]>>('/cinemas');

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch cinemas');
  }

  return response.data.data;
}

/**
 * Add a new cinema (admin only).
 * Pass { url } for smart add (auto-scrape), or { id, name } for manual add.
 */
export async function createCinema(data: CinemaCreate): Promise<Cinema> {
  const response = await apiClient.post<ApiResponse<Cinema>>('/cinemas', data);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to create cinema');
  }

  return response.data.data;
}

/**
 * Update a cinema's name and/or URL (admin only).
 */
export async function updateCinema(id: string, data: CinemaUpdate): Promise<Cinema> {
  const response = await apiClient.put<ApiResponse<Cinema>>(`/cinemas/${id}`, data);

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update cinema');
  }

  return response.data.data;
}

/**
 * Delete a cinema and all its showtimes (admin only).
 * Returns 204 No Content on success.
 */
export async function deleteCinema(id: string): Promise<void> {
  await apiClient.delete(`/cinemas/${id}`);
}

/**
 * Sync cinemas from the database to the JSON config file (admin only).
 */
export async function syncCinemas(): Promise<void> {
  const response = await apiClient.post<ApiResponse<void>>('/cinemas/sync');

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to sync cinemas');
  }
}
