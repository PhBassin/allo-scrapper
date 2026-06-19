import type { MovieWithShowtimes } from '../../types/index.js';
import { formatDuration } from '../../utils/duration.js';
import { hasRating } from '../../utils/movie.js';

function RatingItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold text-gray-400 uppercase">{label}</div>
      <div className="font-bold text-lg">★ {value.toFixed(1)}</div>
    </div>
  );
}

function MovieTrailer({ url }: { url: string }) {
  return (
    <div className="pt-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
      >
        <span aria-hidden="true">▶</span>
        <span>Voir la bande-annonce</span>
      </a>
    </div>
  );
}

function MovieGenres({ genres }: { genres: string[] }) {
  if (!genres || genres.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {genres.map((g) => (
        <span key={g} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{g}</span>
      ))}
    </div>
  );
}

export function MovieHero({ movie }: { movie: MovieWithShowtimes }) {
  const showRatings = hasRating(movie.press_rating) || hasRating(movie.audience_rating);

  return (
    <div className="lg:col-span-1">
      <div className="sticky top-24">
        {movie.poster_url && (
          <img
            src={movie.poster_url}
            alt={`Affiche de ${movie.title}`}
            className="w-full h-auto object-cover rounded-xl shadow-lg mb-6"
            loading="lazy"
          />
        )}

        <div className="card p-6 space-y-4">
          <h1 className="text-2xl font-bold leading-tight">{movie.title}</h1>

          <div className="space-y-2 text-sm">
            {movie.duration_minutes && (
              <p>
                <span className="text-gray-500">Durée:</span> {formatDuration(movie.duration_minutes)}
              </p>
            )}

            {movie.director && (
              <p><span className="text-gray-500">Réalisateur:</span> {movie.director}</p>
            )}

            {movie.screenwriters && movie.screenwriters.length > 0 && (
              <p>
                <span className="text-gray-500">Scénario:</span> {movie.screenwriters.join(', ')}
              </p>
            )}

            <MovieGenres genres={movie.genres} />

            {movie.trailer_url && <MovieTrailer url={movie.trailer_url} />}
          </div>

          {showRatings && (
            <div className="flex gap-4 pt-2 border-t border-gray-100">
              {hasRating(movie.press_rating) && (
                <RatingItem label="Presse" value={movie.press_rating!} />
              )}
              {hasRating(movie.audience_rating) && (
                <RatingItem label="Public" value={movie.audience_rating!} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
