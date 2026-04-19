/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DaySelector from './DaySelector';


const WEEK_START = '2026-03-25';
// Fixed "today" in the week: 2026-03-30 (Monday)
const FIXED_NOW = new Date('2026-03-30T14:00:00');
const FIXED_TODAY = '2026-03-30';

describe('DaySelector — toggle compact (Maintenant ⇄ Tous les jours)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-30T14:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a single toggle button instead of two separate buttons', () => {
    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
        isNowActive={false}
      />
    );

    // Must NOT have both a "Maintenant" button AND a "Tous les jours" button as separate elements
    // Instead should have one toggle button with testid "day-selector-mode-toggle"
    expect(screen.getByTestId('day-selector-mode-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('day-selector-all')).not.toBeInTheDocument();
  });

  it('toggle shows "Tous les jours" label when isNowActive is false and selectedDate is null', () => {
    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
        isNowActive={false}
      />
    );

    const toggle = screen.getByTestId('day-selector-mode-toggle');
    expect(toggle).toHaveTextContent(/tous les jours/i);
  });

  it('toggle shows "Maintenant" label when isNowActive is true', () => {
    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate="2026-03-30"
        onSelectDate={vi.fn()}
        isNowActive={true}
      />
    );

    const toggle = screen.getByTestId('day-selector-mode-toggle');
    expect(toggle).toHaveTextContent(/maintenant/i);
    expect(toggle).toHaveAttribute('data-now-active', 'true');
  });

  it('clicking toggle when in "Tous les jours" mode calls onNow', () => {
    const onNow = vi.fn();

    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
        onNow={onNow}
        isNowActive={false}
      />
    );

    fireEvent.click(screen.getByTestId('day-selector-mode-toggle'));
    expect(onNow).toHaveBeenCalledOnce();
    expect(onNow).toHaveBeenCalledWith('2026-03-30', '14:00');
  });

  it('clicking toggle when in "Maintenant" mode calls onSelectDate(null)', () => {
    const onSelectDate = vi.fn();

    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate="2026-03-30"
        onSelectDate={onSelectDate}
        isNowActive={true}
      />
    );

    fireEvent.click(screen.getByTestId('day-selector-mode-toggle'));
    expect(onSelectDate).toHaveBeenCalledWith(null);
  });

  it('toggle is disabled when today is outside the week', () => {
    vi.setSystemTime(new Date('2030-01-01T10:00:00'));

    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
        isNowActive={false}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).toBeDisabled();
  });

  it('toggle has aria-pressed attribute reflecting isNowActive state', () => {
    const { rerender } = render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
        isNowActive={false}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate="2026-03-30"
        onSelectDate={vi.fn()}
        isNowActive={true}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DaySelector — format jour compact (une ligne)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-30T14:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('day buttons do NOT have flex-col class (no vertical stack)', () => {
    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    const dayButton = screen.getByTestId('day-selector-2026-03-25');
    expect(dayButton).not.toHaveClass('flex-col');
  });

  it('day buttons render weekday and day number inline on one line', () => {
    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    // The first day (2026-03-25 = mercredi) should show weekday + day number
    const dayButton = screen.getByTestId('day-selector-2026-03-25');
    expect(dayButton).toHaveTextContent(/mer/i); // weekday
    expect(dayButton).toHaveTextContent(/25/);   // day number
    // Month should NOT be rendered as separate element
    expect(dayButton.querySelectorAll('span').length).toBeLessThanOrEqual(2);
  });

  it('renders 7 day buttons', () => {
    render(
      <DaySelector
        weekStart="2026-03-25"
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    for (let i = 25; i <= 31; i++) {
      const dateStr = `2026-03-${String(i).padStart(2, '0')}`;
      expect(screen.getByTestId(`day-selector-${dateStr}`)).toBeInTheDocument();
    }
  });
});

describe('DaySelector — toggle (legacy compatibility)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the toggle as the first button', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBe(screen.getByTestId('day-selector-mode-toggle'));
  });

  it('toggle is enabled when today is within the week', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).not.toBeDisabled();
  });

  it('toggle is disabled when today is outside the week', () => {
    vi.setSystemTime(new Date('2030-01-01T10:00:00'));

    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).toBeDisabled();
  });

  it('calls onNow with today date and current HH:MM when clicked in "Tous les jours" mode', () => {
    const handleNow = vi.fn();

    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onNow={handleNow}
      />
    );

    fireEvent.click(screen.getByTestId('day-selector-mode-toggle'));

    expect(handleNow).toHaveBeenCalledOnce();
    expect(handleNow).toHaveBeenCalledWith(FIXED_TODAY, '14:00');
  });

  it('shows toggle as active (data-now-active) when isNowActive is true', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={FIXED_TODAY}
        onSelectDate={vi.fn()}
        isNowActive={true}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).toHaveAttribute('data-now-active', 'true');
  });

  it('toggle has no data-now-active when isNowActive is false', () => {
    render(
      <DaySelector
        weekStart={WEEK_START}
        selectedDate={null}
        onSelectDate={vi.fn()}
        isNowActive={false}
      />
    );

    expect(screen.getByTestId('day-selector-mode-toggle')).not.toHaveAttribute('data-now-active', 'true');
  });
});
