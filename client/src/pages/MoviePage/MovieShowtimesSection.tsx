import type { MovieWithShowtimes } from '../../types/index.js';
import TheaterShowtimes from '../../components/TheaterShowtimes.js';

export function MovieShowtimesSection({ movie }: { movie: MovieWithShowtimes }) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span>📅 Horaires et Cinémas</span>
      </h2>
      <TheaterShowtimes theaters={movie.theaters} movie={movie} />
    </section>
  );
}
