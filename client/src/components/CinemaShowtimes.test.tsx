/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('displays date selector even when there is only one date', () => {
    const singleDateCinemas: CinemaWithShowtimes[] = [
      {
        id: 'C1',
        name: 'Cinema 1',
        address: 'Address 1',
        city: 'Paris',
        showtimes: [
          { id: 's1', date: '2026-02-18', time: '14:00', experiences: [] },
          { id: 's2', date: '2026-02-18', time: '16:00', experiences: [] }
        ]
      } as any
    ];

    renderWithRouter(<CinemaShowtimes cinemas={singleDateCinemas} />);
    
    // Date selector should be visible
    expect(screen.getByText('18')).toBeInTheDocument(); // Day number
    
    // Showtimes should be visible
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
  });

  it('displays the correct date label when there is only one date', () => {
    const singleDateCinemas: CinemaWithShowtimes[] = [
      {
        id: 'C1',
        name: 'Cinema 1',
        address: 'Address 1',
        city: 'Paris',
        showtimes: [
          { id: 's1', date: '2026-02-18', time: '14:00', experiences: [] }
        ]
      } as any
    ];

    renderWithRouter(<CinemaShowtimes cinemas={singleDateCinemas} />);
    
    // Should display the date button with correct format
    const dateButton = screen.getByText('18').closest('button');
    expect(dateButton).toBeInTheDocument();
    
    // Button should have active styling (since it's the only date)
    expect(dateButton).toHaveClass('border-primary');
  });
});

describe('CinemaShowtimes — bouton Maintenant', () => {
  const FIXED_TODAY = '2026-02-18';
  // Current time 15:00 — showtimes at 14:00 are past, 16:00 and 20:00 are future
  const FIXED_NOW = new Date('2026-02-18T15:00:00');

  const cinemasWithToday: CinemaWithShowtimes[] = [
    {
      id: 'C1',
      name: 'Cinema 1',
      address: 'Address 1',
      city: 'Paris',
      showtimes: [
        { id: 's1', date: FIXED_TODAY, time: '14:00', experiences: [] }, // past
        { id: 's4', date: FIXED_TODAY, time: '16:00', experiences: [] }, // future
        { id: 's2', date: '2026-02-19', time: '16:00', experiences: [] },
      ],
    } as any,
    {
      id: 'C2',
      name: 'Cinema 2',
      address: 'Address 2',
      city: 'Paris',
      showtimes: [
        { id: 's3', date: FIXED_TODAY, time: '20:00', experiences: [] }, // future
      ],
    } as any,
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Maintenant button as the first button', () => {
    renderWithRouter(<CinemaShowtimes cinemas={cinemasWithToday} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent(/maintenant/i);
  });

  it('Maintenant button is disabled when today has no showtimes in the list', () => {
    const notoday: CinemaWithShowtimes[] = [
      {
        id: 'C1',
        name: 'Cinema 1',
        address: 'Address 1',
        city: 'Paris',
        showtimes: [
          { id: 's1', date: '2026-02-19', time: '14:00', experiences: [] },
        ],
      } as any,
    ];
    renderWithRouter(<CinemaShowtimes cinemas={notoday} />);
    expect(screen.getByRole('button', { name: /maintenant/i })).toBeDisabled();
  });

  it('filters out showtimes before current time when Maintenant is clicked', () => {
    renderWithRouter(<CinemaShowtimes cinemas={cinemasWithToday} />);

    // Initially today is selected — all three today's showtimes visible
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));

    // 14:00 is before 15:00, should be gone
    expect(screen.queryByText('14:00')).not.toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('resets time filter when another date button is clicked after Maintenant', () => {
    renderWithRouter(<CinemaShowtimes cinemas={cinemasWithToday} />);

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));
    expect(screen.queryByText('14:00')).not.toBeInTheDocument();

    // Click Feb 19 button
    const dateBtn = screen.getByText('19').closest('button');
    fireEvent.click(dateBtn!);

    // Now on Feb 19 — no time filter, show 16:00
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.queryByText('14:00')).not.toBeInTheDocument(); // no Feb 18 showtimes shown
  });
});
