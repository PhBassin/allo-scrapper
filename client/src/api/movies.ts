import apiClient from './core';
import type { ApiResponse, MovieWithShowtimes, Movie } from '../types';

export async function getWeeklyMovies(): Promise<{ movies: MovieWithShowtimes[]; weekStart: string }> {
  const response = await apiClient.get<ApiResponse<{ movies: MovieWithShowtimes[]; weekStart: string }>>('/movies');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch movies');
  }
  return response.data;
}

export async function getMoviesByDate(date: string): Promise<{ movies: MovieWithShowtimes[]; weekStart: string; date: string }> {
  const response = await apiClient.get<ApiResponse<{ movies: MovieWithShowtimes[]; weekStart: string; date: string }>>('/movies', { date });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch movies');
  }
  return response.data;
}

export async function getMovieById(id: number): Promise<MovieWithShowtimes> {
  const response = await apiClient.get<ApiResponse<MovieWithShowtimes>>(`/movies/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch movie');
  }
  return response.data;
}

export async function searchMovies(query: string): Promise<Movie[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const response = await apiClient.get<ApiResponse<{ movies: Movie[]; query: string }>>('/movies/search', { q: query.trim() });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to search movies');
  }

  return response.data.movies;
}
