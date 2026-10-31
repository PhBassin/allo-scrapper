/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FilterBar from './FilterBar';

// Mock MovieSearchBar
vi.mock('./MovieSearchBar', () => ({
  default: ({ onFilter, resetKey }: any) => (
    <input
      data-testid="search-input"
      data-reset-key={resetKey ?? 0}
      placeholder="Rechercher un film..."
      onChange={(e) => onFilter?.([{ id: 1, title: e.target.value, genres: [], actors: [], source_url: '' }])}
    />
  ),
}));

// Mock DaySelector
vi.mock('./DaySelector', () => ({
  default: ({ onSelectDate, onNow, isNowActive, selectedDate }: any) => (
    <div data-testid="day-selector">
      <button data-testid="day-now" onClick={() => onNow?.('2026-03-30', '14:00')}>
        Maintenant {isNowActive ? '(actif)' : ''}
      </button>
      <button data-testid="day-mon" onClick={() => onSelectDate('2026-03-30')}>
        Lun {selectedDate === '2026-03-30' ? '(select)' : ''}
      </button>
    </div>
  ),
}));

describe('FilterBar', () => {
  const WEEK_START = '2026-03-25';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderFilterBar = (props: {
    weekStart?: string;
    selectedDate?: string;
    onSelectDate?: any;
    onNow?: any;
    isNowActive?: boolean;
    onFilter?: any;
    onReset?: any;
  } = {}) =>
    render(
      <MemoryRouter>
        <FilterBar
          weekStart={WEEK_START}
          selectedDate=""
          onSelectDate={vi.fn()}
          onNow={vi.fn()}
          isNowActive={false}
          onFilter={vi.fn()}
          onReset={vi.fn()}
          {...props}
        />
      </MemoryRouter>
    );

  it('renders the search bar, day selector, and reset button', () => {
    renderFilterBar();

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('day-selector')).toBeInTheDocument();
    expect(screen.getByTestId('filter-reset')).toBeInTheDocument();
  });

  it('calls onReset when reset button is clicked', () => {
    const onReset = vi.fn();
    renderFilterBar({ onReset });

    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('calls onFilter when search input changes', async () => {
    const onFilter = vi.fn();
    renderFilterBar({ onFilter });

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'Inception' } });

    await waitFor(() => {
      expect(onFilter).toHaveBeenCalled();
    });
  });

  it('passes onSelectDate to DaySelector', () => {
    const onSelectDate = vi.fn();
    renderFilterBar({ onSelectDate });

    fireEvent.click(screen.getByTestId('day-mon'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-03-30');
  });

  it('passes onNow to DaySelector', () => {
    const onNow = vi.fn();
    renderFilterBar({ onNow });

    fireEvent.click(screen.getByTestId('day-now'));
    expect(onNow).toHaveBeenCalledWith('2026-03-30', '14:00');
  });

  it('passes isNowActive to DaySelector', () => {
    renderFilterBar({ isNowActive: true });
    expect(screen.getByText(/Maintenant.*actif/)).toBeInTheDocument();
  });

  it('reset button is always visible', () => {
    renderFilterBar();
    expect(screen.getByTestId('filter-reset')).toBeInTheDocument();
  });

  it('renders with flex layout (search flex-grow)', () => {
    renderFilterBar();
    const container = screen.getByTestId('filter-bar');
    expect(container.className).toContain('flex');
  });

  it('uses responsive layout (column on mobile, row on desktop)', () => {
    renderFilterBar();
    const container = screen.getByTestId('filter-bar');
    expect(container.className).toContain('flex-col');
    expect(container.className).toContain('sm:flex-row');
  });

  it('forwards resetKey to MovieSearchBar', () => {
    renderFilterBar({ resetKey: 3 } as any);
    const input = screen.getByTestId('search-input');
    expect(input.getAttribute('data-reset-key')).toBe('3');
  });
});
