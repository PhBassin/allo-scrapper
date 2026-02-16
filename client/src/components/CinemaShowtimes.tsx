import { useState, useMemo } from 'react';
import type { CinemaWithShowtimes } from '../types';
import ShowtimeList from './ShowtimeList';
import { Link } from 'react-router-dom';
import { getUniqueDates, formatDateLabel } from '../utils/date';

interface CinemaShowtimesProps {
  cinemas: CinemaWithShowtimes[];
  initialDate?: string;
}

export default function CinemaShowtimes({ cinemas, initialDate }: CinemaShowtimesProps) {
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
      {dates.length > 1 && (
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max">
            {dates.map((date) => {
              const label = formatDateLabel(date);
              const isActive = date === selectedDate;

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`
                    px-4 py-2 rounded-lg border-2 transition-all text-center min-w-[80px]
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
      )}

      {/* Cinemas List */}
      <div className="space-y-4">
        {cinemas.map((cinema) => {
          const dailyShowtimes = cinema.showtimes.filter(s => s.date === selectedDate);
          if (dailyShowtimes.length === 0) return null;

          return (
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
                <ShowtimeList showtimes={dailyShowtimes} />
              </div>
            </div>
          );
        })}

        {cinemas.every(c => c.showtimes.filter(s => s.date === selectedDate).length === 0) && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">Aucune séance ce jour-là</p>
          </div>
        )}
      </div>
    </div>
  );
}
