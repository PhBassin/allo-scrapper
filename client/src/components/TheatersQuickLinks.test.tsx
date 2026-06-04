import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import TheatersQuickLinks from './TheatersQuickLinks';

const mockTheaters = [
  { id: 'C0001', name: 'UGC Opéra', city: 'Paris', screen_count: 5 },
  { id: 'C0002', name: 'Pathé Wepler', city: 'Paris', screen_count: 8 },
];

const renderComponent = (props: Partial<React.ComponentProps<typeof TheatersQuickLinks>> = {}) =>
  render(
    <MemoryRouter>
      <TheatersQuickLinks
        theaters={mockTheaters}
        canAddTheater={false}
        onAddTheater={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('TheatersQuickLinks', () => {
  it('renders a link for each theater', () => {
    renderComponent();

    expect(screen.getByText('UGC Opéra')).toBeInTheDocument();
    expect(screen.getByText('Pathé Wepler')).toBeInTheDocument();
  });

  it('shows "+ Ajouter un cinéma" button when canAddTheater is true', () => {
    renderComponent({ canAddTheater: true });

    expect(screen.getByText('+ Ajouter un cinéma')).toBeInTheDocument();
  });

  it('hides "+ Ajouter un cinéma" button when canAddTheater is false', () => {
    renderComponent({ canAddTheater: false });

    expect(screen.queryByText('+ Ajouter un cinéma')).not.toBeInTheDocument();
  });

  it('calls onAddTheater when the button is clicked', () => {
    const onAddTheater = vi.fn();
    renderComponent({ canAddTheater: true, onAddTheater });

    fireEvent.click(screen.getByText('+ Ajouter un cinéma'));

    expect(onAddTheater).toHaveBeenCalledTimes(1);
  });

  it('renders theater links with correct href', () => {
    renderComponent();

    const ugcLink = screen.getByText('UGC Opéra').closest('a');
    expect(ugcLink).toHaveAttribute('href', '/theater/C0001');
  });
});
