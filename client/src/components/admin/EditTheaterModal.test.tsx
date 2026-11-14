import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EditTheaterModal from './EditTheaterModal';
import type { Theater } from '../../types';

const theater: Theater = {
  id: 'C0072',
  name: 'Le Grand Action',
  url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html',
  address: '5 Rue des Écoles',
  postal_code: '75005',
  city: 'Paris',
};

const HINT = /replaced on the next scrape when the source site provides/i;

function renderModal(t: Theater) {
  render(<EditTheaterModal isOpen theater={t} onClose={vi.fn()} onSave={vi.fn()} />);
}

describe('EditTheaterModal scrape hint', () => {
  it('warns that a scrape replaces the scraped fields, without naming a source', () => {
    renderModal(theater);

    const hint = screen.getByText(HINT);
    expect(hint).toHaveAttribute('id', 'edit-theater-scrape-hint');
    expect(hint.textContent).not.toMatch(/allocin/i);
    for (const label of ['Name', 'Address', 'Postal Code', 'City']) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toHaveAttribute(
        'aria-describedby',
        'edit-theater-scrape-hint'
      );
    }
  });

  it('shows no hint for a theater without a URL, which is never scraped', () => {
    renderModal({ ...theater, url: undefined });

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Address/)).not.toHaveAttribute('aria-describedby');
  });

  it('shows the hint as soon as a URL is typed in', () => {
    renderModal({ ...theater, url: undefined });

    fireEvent.change(screen.getByLabelText(/^Allocine URL/), { target: { value: 'https://example.com/t' } });

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });
});
