import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CinemaShowtimes from './CinemaShowtimes';
import type { CinemaWithShowtimes } from '../types';

const mockCinemas: CinemaWithShowtimes[] = [
  {
    id: 'C1',
    name: 'Cinema 1',
    address: 'Address 1',
    city: 'Paris',
    showtimes: [
      { id: 's1', date: '2026-02-18', time: '14:00', experiences: [] },
      { id: 's2', date: '2026-02-19', time: '16:00', experiences: [] }
    ]
  } as any,
  {
    id: 'C2',
    name: 'Cinema 2',
    address: 'Address 2',
    city: 'Paris',
    showtimes: [
      { id: 's3', date: '2026-02-18', time: '20:00', experiences: [] }
    ]
  } as any
];

const renderWithRouter = (ui: React.ReactElement) => {
  return render(ui, { wrapper: BrowserRouter });
};

describe('CinemaShowtimes Component', () => {
  it('renders empty state when no cinemas provided', () => {
    renderWithRouter(<CinemaShowtimes cinemas={[]} />);
    expect(screen.getByText(/Aucune séance disponible/i)).toBeInTheDocument();
  });

  it('renders cinemas and showtimes for the default date', () => {
    // Set fixed today date for tests if needed, but here we can just rely on the first date in the list
    renderWithRouter(<CinemaShowtimes cinemas={mockCinemas} />);
    
    expect(screen.getByText('Cinema 1')).toBeInTheDocument();
    expect(screen.getByText('Cinema 2')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
    expect(screen.queryByText('16:00')).not.toBeInTheDocument(); // different date
  });

  it('changes showtimes when a different date is selected', () => {
    renderWithRouter(<CinemaShowtimes cinemas={mockCinemas} />);
    
    // Find the button for Feb 19
    const dateButton = screen.getByText('19').closest('button');
    expect(dateButton).toBeInTheDocument();
    
    fireEvent.click(dateButton!);
    
    expect(screen.getByText('Cinema 1')).toBeInTheDocument();
    expect(screen.queryByText('Cinema 2')).not.toBeInTheDocument(); // Cinema 2 has no showtimes on Feb 19
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.queryByText('14:00')).not.toBeInTheDocument();
  });

  it('renders initialDate if provided', () => {
    renderWithRouter(<CinemaShowtimes cinemas={mockCinemas} initialDate="2026-02-19" />);
    
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.queryByText('14:00')).not.toBeInTheDocument();
  });
});
