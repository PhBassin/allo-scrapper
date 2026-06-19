import type { Movie, ShowtimeWithMovie, Theater } from '../../types/index.js';
import { MovieShowtimeCard } from './MovieShowtimeCard.js';

interface ShowtimesListProps {
  movieGroups: Array<{ movie: Movie; showtimes: ShowtimeWithMovie[] }>;
  theater: Theater;
}

export function ShowtimesList({ movieGroups, theater }: ShowtimesListProps) {
  if (movieGroups.length === 0) return <EmptyShowtimes />;
  return (
    <div className="min-h-[300px]">
      <div className="space-y-6">
        {movieGroups.map(({ movie, showtimes }) => (
          <MovieShowtimeCard
            key={movie.id}
            movie={movie}
            showtimes={showtimes}
            theater={theater}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyShowtimes() {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <p className="text-gray-500 font-medium">Aucune séance programmée ce jour-là</p>
      <p className="text-sm text-gray-400 mt-1">Essayez un autre jour de la semaine</p>
    </div>
  );
}