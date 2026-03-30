import { memo } from 'react';
import type { ShowtimeWithFilm } from '../types';

interface CinemaDateSelectorProps {
  dates: string[];
  selectedDate: string;
  showtimes: ShowtimeWithFilm[];
  onSelectDate: (date: string) => void;
  formatDateLabel: (dateStr: string) => { weekday: string; day: number; month: string };
  onNow?: (date: string, afterTime: string) => void;
  isNowActive?: boolean;
}

function CinemaDateSelector({ dates, selectedDate, showtimes, onSelectDate, formatDateLabel, onNow, isNowActive = false }: CinemaDateSelectorProps) {
  if (dates.length === 0) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayInDates = dates.includes(today);

  const handleNowClick = () => {
    if (!todayInDates) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    onNow?.(today, `${hh}:${mm}`);
  };

  return (
    <div className="mb-8 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-2 min-w-max">
        {/* Maintenant button — always first */}
        <button
          onClick={handleNowClick}
          disabled={!todayInDates}
          data-now-active={isNowActive || undefined}
          className={`
            px-4 py-3 rounded-xl border-2 transition-all text-center min-w-[90px] group active:scale-95
            ${isNowActive
              ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-sm cursor-pointer'
              : 'border-transparent bg-white text-gray-600 hover:bg-gray-50 cursor-pointer'
            }
            ${!todayInDates ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div className={`text-xs uppercase font-bold mb-0.5 ${isNowActive ? 'text-teal-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
            ⏱
          </div>
          <div className="text-sm font-bold leading-none">
            Maintenant
          </div>
        </button>

        {dates.map((date) => {
          const label = formatDateLabel(date);
          const isActive = date === selectedDate && !isNowActive;
          // ⚡ PERFORMANCE: Use .some() instead of .filter() to early exit when finding
          // if a date has showtimes, changing O(N) to O(1) in best case and O(K) in average case.
          const hasShowtimes = showtimes.some(s => s.date === date);

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`
                px-4 py-3 rounded-xl border-2 transition-all text-center min-w-[90px] group cursor-pointer active:scale-95
                ${isActive
                  ? 'border-primary bg-yellow-50 text-black shadow-sm'
                  : 'border-transparent bg-white text-gray-600 hover:bg-gray-50'
                }
                ${!hasShowtimes && !isActive ? 'opacity-50' : ''}
              `}
            >
              <div className={`text-xs uppercase font-bold mb-0.5 ${isActive ? 'text-primary-dark' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {label.weekday}
              </div>
              <div className="text-lg font-bold leading-none">
                {label.day}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {label.month}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize component to prevent re-renders when parent re-renders
// but selectedDate and showtimes haven't changed.
export default memo(CinemaDateSelector);
