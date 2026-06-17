import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MovieCard from './MovieCard.js';
import type { MovieWithShowtimes } from '../types/index.js';

vi.mock('./TheaterShowtimes', () => ({
  default: () => <div data-testid="theater-showtimes-mock" />,
}));

function makeMovie(overrides: Partial<MovieWithShowtimes> = {}): MovieWithShowtimes {
  return {
    id: 1,
    title: 'Film Test',
    original_title: 'Test Film',
    genres: ['Drame', 'Thriller'],
    actors: [],
    source_url: 'https://example.com/film/1',
    poster_url: 'https://example.com/poster.jpg',
    duration_minutes: 125,
    director: 'Jane Doe',
    nationality: 'Française',
    certificate: 'Tous publics',
    press_rating: 4.2,
    audience_rating: 3.8,
    synopsis: 'Un synopsis.',
    theaters: [],
    ...overrides,
  } as MovieWithShowtimes;
}

function renderCard(movie: MovieWithShowtimes, props: { isNew?: boolean; initialAfterTime?: string | null } = {}) {
  return render(
    <MemoryRouter>
      <MovieCard movie={movie} {...props} />
    </MemoryRouter>
  );
}

describe('MovieCard', () => {
  it('renders title, genres, meta and ratings', () => {
    renderCard(makeMovie());

    expect(screen.getByText('Film Test')).toBeInTheDocument();
    expect(screen.getByText('Test Film')).toBeInTheDocument();
    expect(screen.getByText('Drame')).toBeInTheDocument();
    expect(screen.getByText('Thriller')).toBeInTheDocument();
    // fallow-ignore-next-line code-duplication
    expect(screen.getByText(/Durée:/)).toBeInTheDocument();
    expect(screen.getByText(/2h 5min/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('3.8')).toBeInTheDocument();
  });

  it('shows the NOUVEAU badge when isNew is true', () => {
    renderCard(makeMovie(), { isNew: true });
    expect(screen.getByText('NOUVEAU')).toBeInTheDocument();
  });

  it('does not show the NOUVEAU badge by default', () => {
    renderCard(makeMovie());
    expect(screen.queryByText('NOUVEAU')).not.toBeInTheDocument();
  });

  it('hides ratings block when both ratings are absent or zero', () => {
    renderCard(makeMovie({ press_rating: 0, audience_rating: 0 }));
    expect(screen.queryByText('Presse')).not.toBeInTheDocument();
    expect(screen.queryByText('Public')).not.toBeInTheDocument();
  });

  it('toggles the schedule view on button click', () => {
    renderCard(makeMovie({ theaters: [{ id: 't1', name: 'Cinéma A', showtimes: [] }] as any }));

    expect(screen.queryByTestId('theater-showtimes-mock')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Voir les horaires/i }));
    expect(screen.getByTestId('theater-showtimes-mock')).toBeInTheDocument();
    expect(screen.getByText(/Cacher les horaires/i)).toBeInTheDocument();
  });

  it('renders the poster image when poster_url is set', () => {
    renderCard(makeMovie());
    const img = screen.getByAltText(/Affiche de Film Test/i);
    expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg');
  });

  it('falls back to a placeholder when poster_url is missing', () => {
    renderCard(makeMovie({ poster_url: undefined }));
    expect(screen.queryByAltText(/Affiche de/i)).not.toBeInTheDocument();
    expect(screen.getByText('🎬')).toBeInTheDocument();
  });
});
