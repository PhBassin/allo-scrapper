/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DaySelector from './DaySelector';

const WEEK_START = '2026-03-25';
// Fixed "today" in the week: 2026-03-30 (Monday)
const FIXED_NOW = new Date('2026-03-30T14:00:00');
const FIXED_TODAY = '2026-03-30';

describe('DaySelector — bouton Maintenant', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Maintenant button as the first button', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent(/maintenant/i);
  });

  it('Maintenant button is enabled when today is within the week', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /maintenant/i })).not.toBeDisabled();
  });

  it('Maintenant button is disabled when today is outside the week', () => {
    // Week starting in the past, today is way ahead
    vi.setSystemTime(new Date('2030-01-01T10:00:00'));

    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /maintenant/i })).toBeDisabled();
  });

  it('calls onNow with today date and current HH:MM when clicked', () => {
    const handleNow = vi.fn();

    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onNow={handleNow}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));

    expect(handleNow).toHaveBeenCalledOnce();
    expect(handleNow).toHaveBeenCalledWith(FIXED_TODAY, '14:00');
  });

  it('shows Maintenant button as active when isNowActive is true', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={FIXED_TODAY}
        onSelectDate={vi.fn()}
        isNowActive={true}
      />
    );

    expect(screen.getByRole('button', { name: /maintenant/i })).toHaveAttribute('data-now-active', 'true');
  });

  it('shows Maintenant button as inactive when isNowActive is false', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
        isNowActive={false}
      />
    );

    expect(screen.getByRole('button', { name: /maintenant/i })).not.toHaveAttribute('data-now-active', 'true');
  });
});
