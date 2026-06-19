import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MovieHero } from './MovieHero.js';
import type { MovieWithShowtimes } from '../../types/index.js';

vi.mock('../../components/TheaterShowtimes', () => ({
  default: () => <div data-testid="theater-showtimes-mock" />,
}));

function makeMovie(overrides: Partial<MovieWithShowtimes> = {}): MovieWithShowtimes {
  return {
    id: 1,
    title: 'Film Test',
    genres: ['Drame'],
    actors: ['Acteur A', 'Acteur B'],
    source_url: 'https://example.com',
    poster_url: 'https://example.com/poster.jpg',
    duration_minutes: 90,
    director: 'Jane Doe',
    press_rating: 4.5,
    audience_rating: 3.7,
    synopsis: 'Un synopsis.',
    theaters: [],
    ...overrides,
  } as MovieWithShowtimes;
}

describe('MovieHero', () => {
  it('renders title, poster, meta and ratings', () => {
    render(<MovieHero movie={makeMovie()} />);

    expect(screen.getByRole('heading', { name: 'Film Test' })).toBeInTheDocument();
    expect(screen.getByAltText(/Affiche de Film Test/i)).toHaveAttribute(
      'src',
      'https://example.com/poster.jpg'
    );
    // fallow-ignore-next-line code-duplication
    expect(screen.getByText(/1h 30min/)).toBeInTheDocument();
    // fallow-ignore-next-line code-duplication
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    // fallow-ignore-next-line code-duplication
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    // fallow-ignore-next-line code-duplication
    expect(screen.getByText(/3\.7/)).toBeInTheDocument();
  });

  it('hides ratings block when both ratings are absent or zero', () => {
    render(<MovieHero movie={makeMovie({ press_rating: 0, audience_rating: 0 })} />);
    expect(screen.queryByText('Presse')).not.toBeInTheDocument();
    expect(screen.queryByText('Public')).not.toBeInTheDocument();
  });

  it('hides poster and ratings gracefully when fields are missing', () => {
    render(
      <MovieHero
        movie={makeMovie({
          poster_url: undefined,
          press_rating: undefined,
          audience_rating: undefined,
          director: undefined,
        })}
      />
    );

    expect(screen.queryByAltText(/Affiche de/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jane Doe/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Presse')).not.toBeInTheDocument();
  });
});
