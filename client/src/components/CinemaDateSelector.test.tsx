/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CinemaDateSelector from './CinemaDateSelector';
import type { ShowtimeWithFilm } from '../types';

const FIXED_TODAY = '2026-03-30';
const FIXED_TIME = '14:32';
// 2026-03-30T14:32:00
const FIXED_NOW = new Date('2026-03-30T14:32:00');

const mockFormatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return { weekday: 'lun', day: date.getDate(), month: 'mars' };
};

const makeShowtime = (date: string, time = '14:00'): ShowtimeWithFilm => ({
  id: `${date}-${time}`,
  film_id: 1,
  cinema_id: 'C1',
  date,
  time,
  datetime_iso: `${date}T${time}:00.000Z`,
  experiences: [],
  week_start: '2026-03-25',
  film: { id: 1, title: 'Film Test', source_url: '' } as any,
});

describe('CinemaDateSelector — bouton Maintenant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Maintenant button as the first button', () => {
    const dates = [FIXED_TODAY, '2026-03-31'];
    const showtimes = [makeShowtime(FIXED_TODAY), makeShowtime('2026-03-31')];

    render(
      <CinemaDateSelector
        dates={dates}
        selectedDate={FIXED_TODAY}
        showtimes={showtimes}
        onSelectDate={vi.fn()}
        formatDateLabel={mockFormatDateLabel}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Maintenant');
  });

  it('Maintenant button is enabled when today is in the dates list', () => {
    const dates = [FIXED_TODAY];
    const showtimes = [makeShowtime(FIXED_TODAY)];

    render(
      <CinemaDateSelector
        dates={dates}
        selectedDate={FIXED_TODAY}
        showtimes={showtimes}
        onSelectDate={vi.fn()}
        formatDateLabel={mockFormatDateLabel}
      />
    );

    const nowBtn = screen.getByRole('button', { name: /maintenant/i });
    expect(nowBtn).not.toBeDisabled();
  });

  it('Maintenant button is disabled when today is NOT in the dates list', () => {
    const dates = ['2026-03-31', '2026-04-01'];
    const showtimes = [makeShowtime('2026-03-31'), makeShowtime('2026-04-01')];

    render(
      <CinemaDateSelector
        dates={dates}
        selectedDate='2026-03-31'
        showtimes={showtimes}
        onSelectDate={vi.fn()}
        formatDateLabel={mockFormatDateLabel}
      />
    );

    const nowBtn = screen.getByRole('button', { name: /maintenant/i });
    expect(nowBtn).toBeDisabled();
  });

  it('calls onNow with today date and current HH:MM when clicked', () => {
    const handleNow = vi.fn();
    const dates = [FIXED_TODAY];
    const showtimes = [makeShowtime(FIXED_TODAY)];

    render(
      <CinemaDateSelector
        dates={dates}
        selectedDate={FIXED_TODAY}
        showtimes={showtimes}
        onSelectDate={vi.fn()}
        onNow={handleNow}
        formatDateLabel={mockFormatDateLabel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));

    expect(handleNow).toHaveBeenCalledOnce();
    expect(handleNow).toHaveBeenCalledWith(FIXED_TODAY, FIXED_TIME);
  });

  it('shows the Maintenant button as active when isNowActive is true', () => {
    const dates = [FIXED_TODAY];
    const showtimes = [makeShowtime(FIXED_TODAY)];

    render(
      <CinemaDateSelector
        dates={dates}
        selectedDate={FIXED_TODAY}
        showtimes={showtimes}
        onSelectDate={vi.fn()}
        isNowActive={true}
        formatDateLabel={mockFormatDateLabel}
      />
    );

    const nowBtn = screen.getByRole('button', { name: /maintenant/i });
    expect(nowBtn).toHaveAttribute('data-now-active', 'true');
  });

  it('shows the Maintenant button as inactive when isNowActive is false', () => {
    const dates = [FIXED_TODAY];
    const showtimes = [makeShowtime(FIXED_TODAY)];

    render(
      <CinemaDateSelector
        dates={dates}
        selectedDate={FIXED_TODAY}
        showtimes={showtimes}
        onSelectDate={vi.fn()}
        isNowActive={false}
        formatDateLabel={mockFormatDateLabel}
      />
    );

    const nowBtn = screen.getByRole('button', { name: /maintenant/i });
    expect(nowBtn).not.toHaveAttribute('data-now-active', 'true');
  });
});
