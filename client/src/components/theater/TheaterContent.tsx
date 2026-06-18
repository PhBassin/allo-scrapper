import { useMemo } from 'react';
import type { ShowtimeWithMovie, Theater } from '../../types/index.js';
import TheaterDateSelector from '../TheaterDateSelector.js';
import { useDateTimeFilter } from '../../hooks/useDateTimeFilter.js';
import {
  getUniqueDates,
  getInitialSelectedDate,
  groupByMovie,
} from '../../utils/theaterSchedule.js';
import { TheaterBreadcrumb } from './TheaterBreadcrumb.js';
import { TheaterHeader } from './TheaterHeader.js';
import { ShowtimesList } from './ShowtimesList.js';

interface TheaterContentProps {
  theater: Theater;
  showtimes: ShowtimeWithMovie[];
  formatDateLabel: (dateStr: string) => { weekday: string; day: number; month: string };
}

export function TheaterContent({ theater, showtimes, formatDateLabel }: TheaterContentProps) {
  const dates = useMemo(() => getUniqueDates(showtimes), [showtimes]);
  const initialDate = useMemo(() => getInitialSelectedDate(showtimes), [showtimes]);

  const { selectedDate, afterTime, selectDate: handleSelectDate, selectNow: handleNow } = useDateTimeFilter(initialDate);

  const effectiveSelectedDate = useMemo(() => {
    if (dates.length === 0) return '';
    if (selectedDate && dates.includes(selectedDate)) return selectedDate;
    return initialDate;
  }, [dates, selectedDate, initialDate]);

  const selectedShowtimes = useMemo(
    () => showtimes.filter(
      (s) => s.date === effectiveSelectedDate && (!afterTime || s.time >= afterTime)
    ),
    [showtimes, effectiveSelectedDate, afterTime]
  );
  const movieGroups = useMemo(() => groupByMovie(selectedShowtimes), [selectedShowtimes]);

  return (
    <div>
      <TheaterBreadcrumb name={theater.name} />
      <TheaterHeader theater={theater} />

      <div
        className="sticky z-40 bg-gray-50/95 backdrop-blur-sm pt-4 pb-4 mb-6 shadow-sm -mx-4 px-4"
        style={{ top: 'var(--layout-header-offset, 64px)' }}
        data-testid="sticky-date-selector-container"
      >
        <TheaterDateSelector
          dates={dates}
          selectedDate={effectiveSelectedDate}
          showtimes={showtimes}
          onSelectDate={handleSelectDate}
          onNow={handleNow}
          isNowActive={afterTime !== null}
          formatDateLabel={formatDateLabel}
        />
      </div>

      <ShowtimesList movieGroups={movieGroups} theater={theater} />
    </div>
  );
}