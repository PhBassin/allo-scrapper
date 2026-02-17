import type { Showtime } from '../types';
import { getAllocineCinemaUrl } from '../utils/allocine';

interface ShowtimeListProps {
  showtimes: Showtime[];
  cinemaId: string;
}

export default function ShowtimeList({ showtimes, cinemaId }: ShowtimeListProps) {
  // Group showtimes by version (VF/VO)
  const showtimesByVersion = showtimes.reduce((acc, showtime) => {
    const version = showtime.version || 'VF';
    if (!acc[version]) acc[version] = [];
    acc[version].push(showtime);
    return acc;
  }, {} as Record<string, Showtime[]>);

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
              <a
                key={`${showtime.time}-${index}`}
                href={getAllocineCinemaUrl(cinemaId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-primary hover:text-black transition cursor-pointer text-sm font-medium"
              >
                {showtime.time}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
