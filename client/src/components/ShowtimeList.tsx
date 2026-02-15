import type { Showtime } from '../types';

interface ShowtimeListProps {
  showtimes: Showtime[];
}

export default function ShowtimeList({ showtimes }: ShowtimeListProps) {
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
              <span
                key={`${showtime.time}-${index}`}
                className="px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-primary hover:text-black transition cursor-pointer text-sm font-medium"
              >
                {showtime.time}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
