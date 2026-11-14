import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TheaterHeader } from './TheaterHeader.js';
import type { Theater } from '../../types/index.js';

const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

describe('TheaterHeader', () => {
  it('renders the theater name', () => {
    render(<TheaterHeader theater={{ id: 'C1', name: 'Denfert' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Denfert' })).toBeInTheDocument();
  });

  it('renders the full address as a Google Maps link', () => {
    const theater: Theater = {
      id: 'C1',
      name: 'Denfert',
      address: '24, Place Denfert-Rochereau',
      postal_code: '75014',
      city: 'Paris 14e arrondissement',
    };
    render(<TheaterHeader theater={theater} />);

    const link = screen.getByRole('link', { name: 'Ouvrir Denfert dans Google Maps' });
    expect(link).toHaveTextContent('24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
    expect(link).toHaveAttribute(
      'href',
      MAPS_SEARCH + encodeURIComponent('Denfert, 24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement')
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('hover:underline');
    expect(link.closest('p')).toHaveTextContent('📍 24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
  });

  it('renders the link when only the city is known', () => {
    render(<TheaterHeader theater={{ id: 'C1', name: 'Denfert', city: 'Paris' }} />);

    const link = screen.getByRole('link', { name: 'Ouvrir Denfert dans Google Maps' });
    expect(link).toHaveTextContent(/^Paris$/);
    expect(link).toHaveAttribute('href', MAPS_SEARCH + encodeURIComponent('Denfert, Paris'));
  });

  it('renders no address line when every address part is empty', () => {
    const { container } = render(
      <TheaterHeader theater={{ id: 'C1', name: 'Denfert', address: '', postal_code: '', city: '' }} />
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('📍');
  });
});
