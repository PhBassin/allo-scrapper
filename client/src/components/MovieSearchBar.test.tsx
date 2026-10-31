/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MovieSearchBar from './MovieSearchBar';
import type { Movie } from '../types';

// Mock the API client
vi.mock('../api/client', () => ({
  searchMovies: vi.fn(),
}));

// Mock useDebounce to return immediately (no delay in tests)
vi.mock('../hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

// Mock highlightText
vi.mock('../utils/highlight', () => ({
  highlightText: (text: string) => text,
}));

import { searchMovies } from '../api/client';

const makeMovie = (id: number, title: string): Movie => ({
  id,
  title,
  genres: ['Action'],
  actors: [],
  source_url: '',
});

describe('MovieSearchBar — inline filter mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSearchBar = (props: { onFilter?: (movies: Movie[] | null) => void } = {}) =>
    render(
      <MemoryRouter>
        <MovieSearchBar {...props} />
      </MemoryRouter>
    );

  it('calls onFilter with search results when user types', async () => {
    const onFilter = vi.fn();
    const mockResults = [makeMovie(1, 'Inception'), makeMovie(2, 'Interstellar')];
    (searchMovies as any).mockResolvedValue(mockResults);

    renderSearchBar({ onFilter });

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'In');

    await waitFor(() => {
      expect(onFilter).toHaveBeenCalledWith(mockResults);
    });
  });

  it('calls onFilter with null when query is cleared (inactive)', async () => {
    const onFilter = vi.fn();
    const mockResults = [makeMovie(1, 'Inception')];
    (searchMovies as any).mockResolvedValue(mockResults);

    renderSearchBar({ onFilter });

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'In');

    await waitFor(() => {
      expect(onFilter).toHaveBeenCalled();
    });

    onFilter.mockClear();
    await userEvent.clear(input);

    await waitFor(() => {
      expect(onFilter).toHaveBeenCalledWith(null);
    });
  });

  it('calls onFilter with empty array when search yields no matches (active empty)', async () => {
    const onFilter = vi.fn();
    (searchMovies as any).mockResolvedValue([]);

    renderSearchBar({ onFilter });

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'zzz');

    await waitFor(() => {
      expect(onFilter).toHaveBeenCalledWith([]);
    });
  });

  it('still renders navigation links in dropdown when onFilter is provided', async () => {
    const onFilter = vi.fn();
    const mockResults = [makeMovie(1, 'Inception')];
    (searchMovies as any).mockResolvedValue(mockResults);

    renderSearchBar({ onFilter });

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'In');

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    // The dropdown should contain a link to the movie page
    const link = screen.getByRole('link', { name: /Inception/i });
    expect(link).toHaveAttribute('href', '/movie/1');
  });

  it('does not call onFilter when onFilter is not provided (backward compat)', async () => {
    const mockResults = [makeMovie(1, 'Inception')];
    (searchMovies as any).mockResolvedValue(mockResults);

    renderSearchBar(); // no onFilter

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'In');

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    // onFilter shouldn't be called because it wasn't provided
    // (no error thrown means the code handles the missing prop gracefully)
    expect(screen.getByRole('link', { name: /Inception/i })).toBeInTheDocument();
  });

  it('renders a "Voir la fiche" affordance in each dropdown result', async () => {
    const onFilter = vi.fn();
    const mockResults = [makeMovie(1, 'Inception'), makeMovie(2, 'Interstellar')];
    (searchMovies as any).mockResolvedValue(mockResults);

    renderSearchBar({ onFilter });

    await userEvent.type(screen.getByTestId('search-input'), 'In');

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    expect(screen.getByTestId('search-result-fiche-1')).toHaveTextContent('Voir la fiche');
    expect(screen.getByTestId('search-result-fiche-2')).toHaveTextContent('Voir la fiche');
  });

  it('clears local input state when resetKey prop changes', async () => {
    const onFilter = vi.fn();
    (searchMovies as any).mockResolvedValue([makeMovie(1, 'Inception')]);

    function Harness() {
      const [resetKey, setResetKey] = useState(0);
      return (
        <>
          <MovieSearchBar onFilter={onFilter} resetKey={resetKey} />
          <button data-testid="bump-reset" onClick={() => setResetKey(k => k + 1)}>
            bump
          </button>
        </>
      );
    }

    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    );

    const input = screen.getByTestId('search-input') as HTMLInputElement;
    await userEvent.type(input, 'In');

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });
    expect(input.value).toBe('In');

    await userEvent.click(screen.getByTestId('bump-reset'));

    expect(input.value).toBe('');
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
  });
});
