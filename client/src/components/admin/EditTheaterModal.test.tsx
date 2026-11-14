import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EditTheaterModal from './EditTheaterModal';
import type { Theater } from '../../types';

const theater: Theater = {
  id: 'C0072',
  name: 'Le Grand Action',
  address: '5 Rue des Écoles',
  postal_code: '75005',
  city: 'Paris',
};

describe('EditTheaterModal', () => {
  it('warns that a scrape replaces the address fields when AlloCiné provides them', () => {
    render(<EditTheaterModal isOpen theater={theater} onClose={vi.fn()} onSave={vi.fn()} />);

    const hint = screen.getByText(/replaced on the next scrape when AlloCiné provides/i);
    expect(hint).toHaveAttribute('id', 'edit-address-scrape-hint');
    for (const label of ['Address', 'Postal Code', 'City']) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toHaveAttribute(
        'aria-describedby',
        'edit-address-scrape-hint'
      );
    }
  });
});
