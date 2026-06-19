import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMovieQuery } from './useMovieQuery.js';
import * as clientApi from '../api/client.js';

vi.mock('../api/client', () => ({
  getMovieById: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useMovieQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Invalid movie ID error when id is undefined', () => {
    const { result } = renderHook(() => useMovieQuery(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Invalid movie ID');
    expect(result.current.movie).toBeUndefined();
  });

  it('returns Invalid movie ID error when id is not a number', () => {
    const { result } = renderHook(() => useMovieQuery('abc'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Invalid movie ID');
  });

  it('loads movie when id is valid', async () => {
    const movie = {
      id: 1,
      title: 'Film Test',
      genres: [],
      actors: [],
      source_url: 'https://example.com',
      theaters: [],
    };
    vi.mocked(clientApi.getMovieById).mockResolvedValue(movie as any);

    const { result } = renderHook(() => useMovieQuery('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.movie).toEqual(movie);
    expect(result.current.error).toBeNull();
    expect(clientApi.getMovieById).toHaveBeenCalledWith(1);
  });

  it('surfaces error message when the query fails', async () => {
    vi.mocked(clientApi.getMovieById).mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useMovieQuery('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Network down');
    });

    expect(result.current.movie).toBeUndefined();
  });
});
