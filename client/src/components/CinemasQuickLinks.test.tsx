import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import CinemasQuickLinks from './CinemasQuickLinks';

const mockCinemas = [
  { id: 'C0001', name: 'UGC Opéra', city: 'Paris', screen_count: 5 },
  { id: 'C0002', name: 'Pathé Wepler', city: 'Paris', screen_count: 8 },
];

const renderComponent = (props: Partial<React.ComponentProps<typeof CinemasQuickLinks>> = {}) =>
  render(
    <MemoryRouter>
      <CinemasQuickLinks
        cinemas={mockCinemas}
        canAddCinema={false}
        onAddCinema={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('CinemasQuickLinks', () => {
  it('renders a link for each cinema', () => {
    renderComponent();

    expect(screen.getByText('UGC Opéra')).toBeInTheDocument();
    expect(screen.getByText('Pathé Wepler')).toBeInTheDocument();
  });

  it('exposes stable test ids for cinema isolation e2e checks', () => {
    renderComponent();

    expect(screen.getByTestId('cinema-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('cinema-list-item')).toHaveLength(2);
  });

  it('shows "+ Ajouter un cinéma" button when canAddCinema is true', () => {
    renderComponent({ canAddCinema: true });

    expect(screen.getByText('+ Ajouter un cinéma')).toBeInTheDocument();
  });

  it('hides "+ Ajouter un cinéma" button when canAddCinema is false', () => {
    renderComponent({ canAddCinema: false });

    expect(screen.queryByText('+ Ajouter un cinéma')).not.toBeInTheDocument();
  });

  it('calls onAddCinema when the button is clicked', () => {
    const onAddCinema = vi.fn();
    renderComponent({ canAddCinema: true, onAddCinema });

    fireEvent.click(screen.getByText('+ Ajouter un cinéma'));

    expect(onAddCinema).toHaveBeenCalledTimes(1);
  });

  it('renders cinema links with correct href', () => {
    renderComponent();

    const ugcLink = screen.getByText('UGC Opéra').closest('a');
    expect(ugcLink).toHaveAttribute('href', '/cinema/C0001');
  });
});
