import { useMemo, memo, useState, useCallback } from 'react';
import type { Showtime, Movie, Theater } from '../types';
import CalendarPopover from './CalendarPopover';

interface ShowtimeListProps {
  showtimes: Showtime[];
  movie: Movie;
  theater: Theater;
}

function ShowtimeList({ showtimes, movie, theater }: ShowtimeListProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const showtimesByVersion = useMemo(() => showtimes.reduce((acc, showtime) => {
    const version = showtime.version || 'VF';
    if (!acc[version]) acc[version] = [];
    acc[version].push(showtime);
    return acc;
  }, {} as Record<string, Showtime[]>), [showtimes]);

  const versionEntries = Object.entries(showtimesByVersion);

  const handleToggle = useCallback((key: string, button: HTMLButtonElement) => {
    setOpenKey((prev) => {
      if (prev === key) {
        setAnchorEl(null);
        return null;
      }

      setAnchorEl(button);
      return key;
    });
  }, []);

  const handleClose = useCallback(() => {
    setOpenKey(null);
    setAnchorEl(null);
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
                <div key={key} className="relative">
                  <button
                    type="button"
                    onClick={(event) => handleToggle(key, event.currentTarget)}
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
                      movie={movie}
                      theater={theater}
                      anchorEl={anchorEl}
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

export default memo(ShowtimeList);
