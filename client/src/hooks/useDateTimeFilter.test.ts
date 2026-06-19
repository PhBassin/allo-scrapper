import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDateTimeFilter } from './useDateTimeFilter.js';

describe('useDateTimeFilter', () => {
  it('initializes with empty values by default', () => {
    const { result } = renderHook(() => useDateTimeFilter());
    expect(result.current.selectedDate).toBe('');
    expect(result.current.afterTime).toBeNull();
  });

  it('accepts an initial date', () => {
    const { result } = renderHook(() => useDateTimeFilter('2026-03-15'));
    expect(result.current.selectedDate).toBe('2026-03-15');
  });

  it('selectDate clears afterTime', () => {
    const { result } = renderHook(() => useDateTimeFilter());
    act(() => result.current.selectNow('2026-03-15', '14:00'));
    expect(result.current.afterTime).toBe('14:00');
    act(() => result.current.selectDate('2026-03-16'));
    expect(result.current.afterTime).toBeNull();
    expect(result.current.selectedDate).toBe('2026-03-16');
  });

  it('selectNow sets both date and time', () => {
    const { result } = renderHook(() => useDateTimeFilter());
    act(() => result.current.selectNow('2026-03-15', '20:30'));
    expect(result.current.selectedDate).toBe('2026-03-15');
    expect(result.current.afterTime).toBe('20:30');
  });
});