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

    const link = screen.getByRole('link', {
      name: '24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement',
    });
    expect(link).toHaveAttribute(
      'href',
      MAPS_SEARCH + encodeURIComponent('Denfert, 24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement')
    );
  });

  it('keeps the visible address in the accessible name and announces the new tab as its description', () => {
    render(<TheaterAddressLink theater={fullTheater} />);

    const link = screen.getByRole('link');
    expect(link).not.toHaveAttribute('aria-label');
    expect(link).toHaveAccessibleName('24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
    expect(link).toHaveAccessibleDescription('ouvre Google Maps dans un nouvel onglet');
  });

  it('keeps the new-tab hint out of the copied text', () => {
    render(<TheaterAddressLink theater={fullTheater} />);

    const link = screen.getByRole('link');
    // The link text holds the address only, so selecting it copies nothing else.
    expect(link.textContent).toBe('24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
    // The hint lives outside the link and is not rendered (display: none is never copied).
    const hint = document.getElementById(link.getAttribute('aria-describedby') ?? '');
    expect(hint).toHaveTextContent('ouvre Google Maps dans un nouvel onglet');
    expect(hint).toHaveAttribute('hidden');
    expect(link).not.toContainElement(hint);
  });

  it('gives each rendered link its own hint id', () => {
    render(
      <>
        <TheaterAddressLink theater={fullTheater} />
        <TheaterAddressLink theater={{ name: 'UGC Bercy', city: 'Paris' }} />
      </>
    );

    const [first, second] = screen.getAllByRole('link');
    expect(first.getAttribute('aria-describedby')).not.toBe(second.getAttribute('aria-describedby'));
    expect(second).toHaveAccessibleDescription('ouvre Google Maps dans un nouvel onglet');
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

    const link = screen.getByRole('link', { name: 'Paris' });
    expect(link).toHaveAttribute('href', MAPS_SEARCH + encodeURIComponent('Denfert, Paris'));
  });

  it('renders nothing when every address part is empty', () => {
    const { container } = render(
      <TheaterAddressLink theater={{ name: 'Denfert', address: '', postal_code: '', city: '' }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
