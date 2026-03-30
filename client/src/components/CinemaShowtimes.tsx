import { useState, useMemo, useCallback } from 'react';
import type { CinemaWithShowtimes } from '../types';
import ShowtimeList from './ShowtimeList';
import { Link } from 'react-router-dom';
import { getUniqueDates, formatDateLabel } from '../utils/date';

interface CinemaShowtimesProps {
  cinemas: CinemaWithShowtimes[];
  initialDate?: string;
  initialAfterTime?: string | null;
}

export default function CinemaShowtimes({ cinemas, initialDate, initialAfterTime }: CinemaShowtimesProps) {
  const allShowtimes = useMemo(() => 
    cinemas.flatMap(c => c.showtimes),
    [cinemas]
  );

  const dates = useMemo(() => getUniqueDates(allShowtimes), [allShowtimes]);
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && dates.includes(initialDate)) return initialDate;
    const today = new Date().toISOString().split('T')[0];
    return dates.includes(today) ? today : (dates[0] || '');
  });
  const [afterTime, setAfterTime] = useState<string | null>(initialAfterTime ?? null);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setAfterTime(null);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayInDates = dates.includes(today);
  const isNowActive = afterTime !== null;

  const handleNow = useCallback(() => {
    if (!todayInDates) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setSelectedDate(today);
    setAfterTime(`${hh}:${mm}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayInDates, today]);

  // ⚡ PERFORMANCE: Use reduce instead of map().filter() to avoid allocating intermediate
  // objects for cinemas with no showtimes on the selected date, reducing GC pressure and iteration overhead.
  const displayedCinemas = useMemo(() => {
    return cinemas.reduce((acc, cinema) => {
      const filteredShowtimes = cinema.showtimes.filter(
        s => s.date === selectedDate && (!afterTime || s.time >= afterTime)
      );
      if (filteredShowtimes.length > 0) {
        acc.push({ cinema, showtimes: filteredShowtimes });
      }
      return acc;
    }, [] as Array<{ cinema: CinemaWithShowtimes; showtimes: CinemaWithShowtimes['showtimes'] }>);
  }, [cinemas, selectedDate, afterTime]);

  if (cinemas.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-500">Aucune séance disponible cette semaine</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 min-w-max">
          {/* Maintenant button — always first */}
          <button
            onClick={handleNow}
            disabled={!todayInDates}
            data-now-active={isNowActive || undefined}
            className={`
              px-4 py-2 rounded-lg border-2 transition-all text-center min-w-[80px] active:scale-95
              ${isNowActive
                ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-sm cursor-pointer'
                : 'border-transparent bg-white text-gray-600 hover:bg-gray-50 cursor-pointer'
              }
              ${!todayInDates ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className={`text-[10px] uppercase font-bold ${isNowActive ? 'text-teal-700' : 'text-gray-400'}`}>
              ⏱
            </div>
            <div className="text-sm font-bold leading-none">
              Maintenant
            </div>
          </button>

          {dates.map((date) => {
            const label = formatDateLabel(date);
            const isActive = date === selectedDate && !isNowActive;

            return (
              <button
                key={date}
                onClick={() => handleSelectDate(date)}
                className={`
                  px-4 py-2 rounded-lg border-2 transition-all text-center min-w-[80px] cursor-pointer active:scale-95
                  ${isActive 
                    ? 'border-primary bg-yellow-50 text-black shadow-sm' 
                    : 'border-transparent bg-white text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                <div className={`text-[10px] uppercase font-bold ${isActive ? 'text-primary-dark' : 'text-gray-400'}`}>
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

      {/* Cinemas List */}
      <div className="space-y-4">
        {displayedCinemas.map(({ cinema, showtimes }) => (
          <div key={cinema.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">
                  <Link to={`/cinema/${cinema.id}`} className="hover:text-primary transition">
                    {cinema.name}
                  </Link>
                </h3>
                {cinema.address && (
                  <p className="text-sm text-gray-500">
                    {cinema.address}, {cinema.city}
                  </p>
                )}
              </div>
              <Link
                to={`/cinema/${cinema.id}`}
                className="text-xs font-semibold text-primary-dark hover:underline bg-yellow-100 px-2 py-1 rounded"
              >
                Fiche cinéma
              </Link>
            </div>

            <div className="pt-3 border-t border-gray-50">
              <ShowtimeList showtimes={showtimes} />
            </div>
          </div>
        ))}

        {displayedCinemas.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">Aucune séance ce jour-là</p>
          </div>
        )}
      </div>
    </div>
  );
}
