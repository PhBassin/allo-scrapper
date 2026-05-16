import { useMemo, memo, useState, useCallback } from 'react';
import type { Showtime, Film, Cinema } from '../types';
import CalendarPopover from './CalendarPopover';

interface ShowtimeListProps {
  showtimes: Showtime[];
  film: Film;
  cinema: Cinema;
}

function ShowtimeList({ showtimes, film, cinema }: ShowtimeListProps) {
  // Track which showtime button has its popover open (by unique key)
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Group showtimes by version (VF/VO)
  // ⚡ PERFORMANCE: Memoize grouping logic to avoid re-calculation on every render
  const showtimesByVersion = useMemo(() => showtimes.reduce((acc, showtime) => {
    const version = showtime.version || 'VF';
    if (!acc[version]) acc[version] = [];
    acc[version].push(showtime);
    return acc;
  }, {} as Record<string, Showtime[]>), [showtimes]);

  const versionEntries = Object.entries(showtimesByVersion);

  const handleToggle = useCallback((key: string) => {
    setOpenKey(prev => (prev === key ? null : key));
  }, []);

  const handleClose = useCallback(() => {
    setOpenKey(null);
  }, []);

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
            {versionShowtimes.map((showtime, index) => {
              const key = `${version}-${showtime.time}-${index}`;
              const isOpen = openKey === key;

              return (
                <div
                  key={key}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(key)}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className={`px-3 py-1 rounded text-sm font-medium transition active:scale-95 cursor-pointer ${
                      isOpen
                        ? 'bg-primary text-black shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-black'
                    }`}
                  >
                    {showtime.time}
                  </button>

                  {isOpen && (
                    <CalendarPopover
                      showtime={showtime}
                      film={film}
                      cinema={cinema}
                      onClose={handleClose}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize component to prevent re-renders when parent re-renders
// but showtimes data hasn't changed.
export default memo(ShowtimeList);
