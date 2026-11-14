import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TheaterAddressLink from './TheaterAddressLink.js';

const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

const fullTheater = {
  name: 'Denfert',
  address: '24, Place Denfert-Rochereau',
  postal_code: '75014',
  city: 'Paris 14e arrondissement',
};

describe('TheaterAddressLink', () => {
  it('renders the full address as a link to the Google Maps place page', () => {
    render(<TheaterAddressLink theater={fullTheater} />);

    const link = screen.getByRole('link', { name: 'Ouvrir Denfert dans Google Maps' });
    expect(link).toHaveTextContent('24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
    expect(link).toHaveAttribute(
      'href',
      MAPS_SEARCH + encodeURIComponent('Denfert, 24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement')
    );
  });

  it('opens the link in a new tab without leaking the opener', () => {
    render(<TheaterAddressLink theater={fullTheater} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('underlines the link on hover', () => {
    render(<TheaterAddressLink theater={fullTheater} />);
    expect(screen.getByRole('link')).toHaveClass('hover:underline');
  });

  it('prefixes the line with a pin and applies the given class name', () => {
    render(<TheaterAddressLink theater={fullTheater} className="text-sm text-gray-500" />);

    const line = screen.getByRole('link').closest('p');
    expect(line).toHaveTextContent('📍 24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
    expect(line).toHaveClass('text-sm', 'text-gray-500');
  });

  it('renders the link when only the city is known', () => {
    render(<TheaterAddressLink theater={{ name: 'Denfert', city: 'Paris' }} />);

    const link = screen.getByRole('link');
    expect(link).toHaveTextContent(/^Paris$/);
    expect(link).toHaveAttribute('href', MAPS_SEARCH + encodeURIComponent('Denfert, Paris'));
  });

  it('renders nothing when every address part is empty', () => {
    const { container } = render(
      <TheaterAddressLink theater={{ name: 'Denfert', address: '', postal_code: '', city: '' }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
