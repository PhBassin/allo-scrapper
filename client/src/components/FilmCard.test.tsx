import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import FilmCard from './FilmCard';
import type { FilmWithShowtimes } from '../types';

const mockFilm: FilmWithShowtimes = {
  id: 1,
  title: 'Test Movie',
  original_title: 'Original Movie',
  genres: ['Action', 'Drama'],
  poster_url: 'http://example.com/poster.jpg',
  synopsis: 'A test movie synopsis.',
  duration_minutes: 120,
  director: 'Test Director',
  nationality: 'French',
  certificate: 'U',
  press_rating: 4.5,
  audience_rating: 4.2,
  cinemas: [],
  source_url: 'http://example.com/movie'
};

describe('FilmCard', () => {
  const renderFilmCard = () =>
    render(
      <MemoryRouter>
        <FilmCard film={mockFilm} />
      </MemoryRouter>
    );

  it('should not have duplicate redundant tab stops for the same film destination', () => {
    renderFilmCard();
    
    const moviePath = `/film/${mockFilm.id}`;
    const allLinks = screen.getAllByRole('link');
    
    // Only one link should be reachable/discoverable by default role if we hide the second one
    const interactiveLinks = allLinks.filter(link => 
      link.getAttribute('href') === moviePath && 
      link.getAttribute('aria-hidden') !== 'true' &&
      link.getAttribute('tabindex') !== '-1'
    );
    
    expect(interactiveLinks).toHaveLength(1);
    expect(interactiveLinks[0]).toHaveTextContent(mockFilm.title);
  });

  it('should have a descriptive aria-label for the "Fiche complète" link if it is not hidden', () => {
    renderFilmCard();
    
    // If we keep the link, it must be descriptive
    const detailLink = screen.queryByRole('link', { name: /fiche complète/i });
    
    if (detailLink && detailLink.getAttribute('aria-hidden') !== 'true') {
        expect(detailLink).toHaveAttribute('aria-label', `Voir la fiche complète de ${mockFilm.title}`);
    }
  });
});
