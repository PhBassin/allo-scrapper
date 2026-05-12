import { useMemo, memo, useCallback } from 'react';
import type { Showtime } from '../types';
import { toGoogleCalendarFormat } from '../utils/date';

interface ShowtimeListProps {
  showtimes: Showtime[];
  movieTitle?: string;
  theaterName?: string;
  theaterAddress?: string;
}

function ShowtimeList({ showtimes, movieTitle, theaterName, theaterAddress }: ShowtimeListProps) {
  const showtimesByVersion = useMemo(() => showtimes.reduce((acc, showtime) => {
    const version = showtime.version || 'VF';
    if (!acc[version]) acc[version] = [];
    acc[version].push(showtime);
    return acc;
  }, {} as Record<string, Showtime[]>), [showtimes]);

  const isActive = !!theaterName;

  const handleClick = useCallback((showtime: Showtime) => {
    if (!theaterName) return;

    const title = movieTitle || `Séance au ${theaterName}`;
    const dates = toGoogleCalendarFormat(showtime.datetime_iso);
    const location = theaterAddress || theaterName;
    const details = movieTitle
      ? `Séance de ${movieTitle} au ${theaterName} - ${showtime.version || 'VF'}`
      : `Séance au ${theaterName} - ${showtime.version || 'VF'}`;

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', title);
    url.searchParams.set('dates', dates);
    url.searchParams.set('location', location);
    url.searchParams.set('details', details);

    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }, [theaterName, movieTitle, theaterAddress]);

  const versionEntries = Object.entries(showtimesByVersion);

  if (versionEntries.length === 0) {
    return (
      <p className="text-gray-500 text-sm">Aucune séance disponible</p>
    );
  }

  return (
    <div className="space-y-3">
      {versionEntries.map(([version, versionShowtimes]) => (
        <div key={version} className="border-l-4 border-primary pl-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">{version}</p>
          <div className="flex flex-wrap gap-2">
            {versionShowtimes.map((showtime, index) => (
              <button
                key={`${showtime.time}-${index}`}
                type="button"
                disabled={!isActive}
                onClick={() => handleClick(showtime)}
                className={
                  isActive
                    ? 'px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark transition text-sm font-medium cursor-pointer active:scale-95'
                    : 'px-3 py-1 bg-gray-100 text-gray-500 rounded cursor-not-allowed text-sm font-medium opacity-70'
                }
                title={isActive ? `Ajouter au calendrier — ${showtime.time}` : 'Fonctionnalité à venir'}
              >
                {showtime.time}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(ShowtimeList);
