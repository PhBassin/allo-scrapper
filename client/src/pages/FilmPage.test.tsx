import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FilmPage from './FilmPage';
import * as clientApi from '../api/client';

vi.mock('../api/client', () => ({
  getFilmById: vi.fn(),
}));

function renderPage(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/film/:id" element={<FilmPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FilmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trailer link when trailer_url is available', async () => {
    vi.mocked(clientApi.getFilmById).mockResolvedValue({
      id: 1,
      title: 'Film Test',
      genres: ['Drame'],
      actors: ['Acteur Test'],
      source_url: 'https://example.com/film/1',
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=1.html',
      cinemas: [],
    } as any);

    renderPage('/film/1');

    const trailerLink = await screen.findByRole('link', { name: /Voir la bande-annonce/i });
    expect(trailerLink).toHaveAttribute(
      'href',
      'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=1.html'
    );
  });

  it('does not render trailer link when trailer_url is absent', async () => {
    vi.mocked(clientApi.getFilmById).mockResolvedValue({
      id: 1,
      title: 'Film Test',
      genres: ['Drame'],
      actors: ['Acteur Test'],
      source_url: 'https://example.com/film/1',
      cinemas: [],
    } as any);

    renderPage('/film/1');

    await screen.findByRole('heading', { name: 'Film Test' });
    expect(screen.queryByRole('link', { name: /Voir la bande-annonce/i })).not.toBeInTheDocument();
  });
});
