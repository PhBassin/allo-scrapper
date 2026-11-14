/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TheaterShowtimes from './TheaterShowtimes';
import type { TheaterWithShowtimes, Movie } from '../types';

const mockMovie: Movie = {
  id: 1,
  title: 'Test Film',
  genres: [],
  actors: [],
  source_url: 'https://example.com',
};

const mockTheaters: TheaterWithShowtimes[] = [
  {
    id: 'C1',
    name: 'Theater 1',
    address: 'Address 1',
    city: 'Paris',
    showtimes: [
      { id: 's1', date: '2026-02-18', time: '14:00', experiences: [] },
      { id: 's2', date: '2026-02-19', time: '16:00', experiences: [] }
    ]
  } as any,
  {
    id: 'C2',
    name: 'Theater 2',
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

describe('TheaterShowtimes Component', () => {
  it('renders empty state when no theaters provided', () => {
    renderWithRouter(<TheaterShowtimes theaters={[]} movie={mockMovie} />);
    expect(screen.getByText(/Aucune séance disponible/i)).toBeInTheDocument();
  });

  it('renders theaters and showtimes for the default date', () => {
    // Set fixed today date for tests if needed, but here we can just rely on the first date in the list
    renderWithRouter(<TheaterShowtimes theaters={mockTheaters} movie={mockMovie} />);
    
    expect(screen.getByText('Theater 1')).toBeInTheDocument();
    expect(screen.getByText('Theater 2')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
    expect(screen.queryByText('16:00')).not.toBeInTheDocument(); // different date
  });

  it('changes showtimes when a different date is selected', () => {
    renderWithRouter(<TheaterShowtimes theaters={mockTheaters} movie={mockMovie} />);
    
    // Find the button for Feb 19
    const dateButton = screen.getByText('19').closest('button');
    expect(dateButton).toBeInTheDocument();
    
    fireEvent.click(dateButton!);
    
    expect(screen.getByText('Theater 1')).toBeInTheDocument();
    expect(screen.queryByText('Theater 2')).not.toBeInTheDocument(); // Theater 2 has no showtimes on Feb 19
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.queryByText('14:00')).not.toBeInTheDocument();
  });

  it('renders initialDate if provided', () => {
    renderWithRouter(<TheaterShowtimes theaters={mockTheaters} movie={mockMovie} initialDate="2026-02-19" />);
    
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.queryByText('14:00')).not.toBeInTheDocument();
  });

  it('displays date selector even when there is only one date', () => {
    const singleDateTheaters: TheaterWithShowtimes[] = [
      {
        id: 'C1',
        name: 'Theater 1',
        address: 'Address 1',
        city: 'Paris',
        showtimes: [
          { id: 's1', date: '2026-02-18', time: '14:00', experiences: [] },
          { id: 's2', date: '2026-02-18', time: '16:00', experiences: [] }
        ]
      } as any
    ];

    renderWithRouter(<TheaterShowtimes theaters={singleDateTheaters} movie={mockMovie} />);
    
    // Date selector should be visible
    expect(screen.getByText('18')).toBeInTheDocument(); // Day number
    
    // Showtimes should be visible
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
  });

  it('displays the correct date label when there is only one date', () => {
    const singleDateTheaters: TheaterWithShowtimes[] = [
      {
        id: 'C1',
        name: 'Theater 1',
        address: 'Address 1',
        city: 'Paris',
        showtimes: [
          { id: 's1', date: '2026-02-18', time: '14:00', experiences: [] }
        ]
      } as any
    ];

    renderWithRouter(<TheaterShowtimes theaters={singleDateTheaters} movie={mockMovie} />);
    
    // Should display the date button with correct format
    const dateButton = screen.getByText('18').closest('button');
    expect(dateButton).toBeInTheDocument();
    
    // Button should have active styling (since it's the only date)
    expect(dateButton).toHaveClass('border-primary');
  });
});

describe('TheaterShowtimes — bouton Maintenant', () => {
  const FIXED_TODAY = '2026-02-18';
  // Current time 15:00 — showtimes at 14:00 are past, 16:00 and 20:00 are future
  const FIXED_NOW = new Date('2026-02-18T15:00:00');

  const theatersWithToday: TheaterWithShowtimes[] = [
    {
      id: 'C1',
      name: 'Theater 1',
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
      name: 'Theater 2',
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
    renderWithRouter(<TheaterShowtimes theaters={theatersWithToday} movie={mockMovie} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent(/maintenant/i);
  });

  it('Maintenant button is disabled when today has no showtimes in the list', () => {
    const notoday: TheaterWithShowtimes[] = [
      {
        id: 'C1',
        name: 'Theater 1',
        address: 'Address 1',
        city: 'Paris',
        showtimes: [
          { id: 's1', date: '2026-02-19', time: '14:00', experiences: [] },
        ],
      } as any,
    ];
    renderWithRouter(<TheaterShowtimes theaters={notoday} movie={mockMovie} />);
    expect(screen.getByRole('button', { name: /maintenant/i })).toBeDisabled();
  });

  it('filters out showtimes before current time when Maintenant is clicked', () => {
    renderWithRouter(<TheaterShowtimes theaters={theatersWithToday} movie={mockMovie} />);

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
    renderWithRouter(<TheaterShowtimes theaters={theatersWithToday} movie={mockMovie} />);

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

// Detailed address-link behaviour is covered in TheaterAddressLink.test.tsx.
describe('TheaterShowtimes — Google Maps address link', () => {
  const showtimes = [{ id: 's1', date: '2026-02-18', time: '14:00', experiences: [] }];

  it('renders the address of each theater card as a Google Maps link', () => {
    const theaters = [{ id: 'C1', name: 'Denfert', postal_code: '75014', city: 'Paris', showtimes } as any];
    renderWithRouter(<TheaterShowtimes theaters={theaters} movie={mockMovie} />);

    const link = screen.getByRole('link', { description: /Google Maps/ });
    expect(link).toHaveTextContent('75014 Paris');
    expect(link.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
  });

  it('renders no address line when every address part is empty', () => {
    const theaters = [{ id: 'C1', name: 'Denfert', address: '', postal_code: '', city: '', showtimes } as any];
    renderWithRouter(<TheaterShowtimes theaters={theaters} movie={mockMovie} />);

    expect(screen.queryByRole('link', { description: /Google Maps/ })).not.toBeInTheDocument();
  });
});
