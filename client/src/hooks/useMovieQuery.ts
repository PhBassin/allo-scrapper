import { useQuery } from '@tanstack/react-query';
import { getMovieById } from '../api/client.js';
import { deriveMovieError } from '../utils/movie.js';
import type { MovieWithShowtimes } from '../types/index.js';

export interface UseMovieQueryResult {
  movie: MovieWithShowtimes | undefined;
  isLoading: boolean;
  error: string | null;
}

export function useMovieQuery(id: string | undefined): UseMovieQueryResult {
  const movieId = id ? Number(id) : NaN;
  const isInvalidId = Number.isNaN(movieId);

  const { data: movie, isLoading, error: queryError } = useQuery<MovieWithShowtimes>({
    queryKey: ['movie', movieId],
    queryFn: () => getMovieById(movieId),
    enabled: !isInvalidId,
  });

  return {
    movie,
    isLoading: !isInvalidId && isLoading,
    error: deriveMovieError(isInvalidId, queryError),
  };
}
