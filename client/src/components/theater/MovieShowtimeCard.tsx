import { Link } from 'react-router-dom';
import type { Movie, ShowtimeWithMovie, Theater } from '../../types/index.js';
import ShowtimeList from '../ShowtimeList.js';
import { formatDurationShort } from '../../utils/theaterSchedule.js';

interface MovieShowtimeCardProps {
  movie: Movie;
  showtimes: ShowtimeWithMovie[];
  theater: Theater;
}

export function MovieShowtimeCard({ movie, showtimes, theater }: MovieShowtimeCardProps) {
  return (
    <div className="card p-5 md:p-6 transition hover:shadow-md border border-gray-100">
      <div className="flex flex-col md:flex-row gap-6">
        {movie.poster_url && (
          <div className="hidden md:block w-24 flex-shrink-0">
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="w-full rounded shadow-sm"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-grow">
          <div className="mb-4">
            <h2 className="text-xl md:text-2xl font-bold mb-1">
              <Link to={`/movie/${movie.id}`} className="hover:text-primary transition">
                {movie.title}
              </Link>
            </h2>
            <MovieMetaLine movie={movie} />
            <MovieRatings movie={movie} />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <ShowtimeList showtimes={showtimes} movie={movie} theater={theater} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MovieMetaLine({ movie }: { movie: Movie }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
      {movie.duration_minutes && <span>⏱ {formatDurationShort(movie.duration_minutes)}</span>}
      {movie.genres && movie.genres.length > 0 && (
        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{movie.genres[0]}</span>
      )}
      {movie.director && <span className="hidden sm:inline">de {movie.director}</span>}
    </div>
  );
}

function MovieRatings({ movie }: { movie: Movie }) {
  const press = movie.press_rating ?? 0;
  const audience = movie.audience_rating ?? 0;
  const hasPress = press > 0;
  const hasAudience = audience > 0;
  if (!hasPress && !hasAudience) return null;

  return (
    <div className="flex gap-3 mb-4">
      {hasPress && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Presse</span>
          <span className="font-bold text-sm">★ {press.toFixed(1)}</span>
        </div>
      )}
      {hasAudience && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Spectateurs</span>
          <span className="font-bold text-sm">★ {audience.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}