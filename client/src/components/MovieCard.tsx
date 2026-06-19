import { Link } from 'react-router-dom';
import { useState, memo } from 'react';
import type { MovieWithShowtimes } from '../types/index.js';
import TheaterShowtimes from './TheaterShowtimes.js';
import { formatDuration } from '../utils/duration.js';
import { hasRating } from '../utils/movie.js';

interface MovieCardProps {
  movie: MovieWithShowtimes;
  isNew?: boolean;
  initialAfterTime?: string | null;
}

function MoviePoster({ posterUrl, title }: { posterUrl?: string; title: string }) {
  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={`Affiche de ${title}`}
        className="w-40 md:w-32 h-60 md:h-48 object-cover rounded shadow-md"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-40 md:w-32 h-60 md:h-48 bg-gray-200 rounded flex items-center justify-center shadow-inner">
      <span className="text-gray-400 text-4xl">🎬</span>
    </div>
  );
}

function RatingBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-yellow-500 text-lg leading-none">★</span>
      <span className="font-bold">{value.toFixed(1)}</span>
      <span className="text-[10px] text-gray-400 uppercase font-bold">{label}</span>
    </div>
  );
}

function MovieRatings({
  press,
  audience,
}: {
  press?: number;
  audience?: number;
}) {
  if (!hasRating(press) && !hasRating(audience)) return null;
  return (
    <div className="flex gap-4 mb-4 pt-4 border-t border-gray-50">
      {hasRating(press) && <RatingBadge label="Presse" value={press!} />}
      {hasRating(audience) && <RatingBadge label="Public" value={audience!} />}
    </div>
  );
}

function MovieMeta({ movie }: { movie: MovieWithShowtimes }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
      {movie.duration_minutes && (
        <p><strong>Durée:</strong> {formatDuration(movie.duration_minutes)}</p>
      )}
      {movie.director && <p><strong>Réalisateur:</strong> {movie.director}</p>}
      {movie.nationality && <p><strong>Nationalité:</strong> {movie.nationality}</p>}
      {movie.certificate && <p><strong>Classification:</strong> {movie.certificate}</p>}
    </div>
  );
}

function MovieCard({ movie, isNew = false, initialAfterTime }: MovieCardProps) {
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <div className="card hover:shadow-lg transition relative" data-testid="movie-card">
      {isNew && (
        <div className="absolute top-2 right-2 bg-primary text-black text-xs font-bold px-2 py-1 rounded z-10">
          NOUVEAU
        </div>
      )}

      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <MoviePoster posterUrl={movie.poster_url} title={movie.title} />
          </div>

          <div className="flex-grow">
            <h3 className="text-2xl font-bold mb-1">
              <Link to={`/movie/${movie.id}`} className="hover:text-primary transition">
                {movie.title}
              </Link>
            </h3>

            {movie.original_title && movie.original_title !== movie.title && (
              <p className="text-sm text-gray-500 mb-3 italic">{movie.original_title}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-4">
              {movie.genres.map((genre) => (
                <span key={genre} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded">
                  {genre}
                </span>
              ))}
            </div>

            <MovieMeta movie={movie} />
            <MovieRatings press={movie.press_rating} audience={movie.audience_rating} />

            {movie.synopsis && (
              <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{movie.synopsis}</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className={`text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer active:scale-95 ${
                showSchedule
                  ? 'bg-primary text-black'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{showSchedule ? '▼ Cacher les horaires' : '▶ Voir les horaires'}</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{movie.theaters.length} cinémas</span>
            </button>
            <Link
              to={`/movie/${movie.id}`}
              className="text-sm font-bold text-gray-500 hover:text-primary transition"
            >
              Fiche complète →
            </Link>
          </div>

          {showSchedule && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <TheaterShowtimes theaters={movie.theaters} movie={movie} initialAfterTime={initialAfterTime} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize MovieCard to prevent re-renders of the entire list
// when parent state (like scrape progress or date selection loading state) changes.
export default memo(MovieCard);
