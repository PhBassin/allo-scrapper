import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import FilmPage from './FilmPage';
import * as clientApi from '../api/client';
import type { FilmWithShowtimes } from '../types';

vi.mock('../api/client', () => ({
  getFilmById: vi.fn(),
  triggerScrape: vi.fn(),
}));

describe('FilmPage', () => {
  const film: FilmWithShowtimes = {
    id: 123,
    title: 'Test Film',
    genres: ['Drame'],
    actors: [],
    source_url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=123.html',
    cinemas: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientApi.getFilmById).mockResolvedValue(film);
    vi.mocked(clientApi.triggerScrape).mockResolvedValue({ reportId: 1, message: 'ok' });
  });

  it('triggers a film-only scrape from the film page button', async () => {
    render(
      <MemoryRouter initialEntries={['/film/123']}>
        <Routes>
          <Route path="/film/:id" element={<FilmPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Test Film' });

    fireEvent.click(screen.getByRole('button', { name: /Scraper uniquement ce film/i }));

    await waitFor(() => {
      expect(clientApi.triggerScrape).toHaveBeenCalledWith(123);
    });
    expect(screen.getByText('Scraping film démarré !')).toBeInTheDocument();
  });
});
