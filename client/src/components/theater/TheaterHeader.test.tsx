import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TheaterHeader } from './TheaterHeader.js';

// Detailed address-link behaviour is covered in TheaterAddressLink.test.tsx.
describe('TheaterHeader', () => {
  it('renders the theater name', () => {
    render(<TheaterHeader theater={{ id: 'C1', name: 'Denfert' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Denfert' })).toBeInTheDocument();
  });

  it('renders the address as a Google Maps link', () => {
    render(<TheaterHeader theater={{ id: 'C1', name: 'Denfert', postal_code: '75014', city: 'Paris' }} />);

    const link = screen.getByRole('link', { description: /Google Maps/ });
    expect(link).toHaveTextContent('75014 Paris');
    expect(link.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
  });

  it('renders no address line when every address part is empty', () => {
    render(<TheaterHeader theater={{ id: 'C1', name: 'Denfert', address: '', postal_code: '', city: '' }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
