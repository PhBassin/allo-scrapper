import type { Theater } from '../../types/index.js';

interface TheaterHeaderProps {
  theater: Theater;
}

export function TheaterHeader({ theater }: TheaterHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{theater.name}</h1>
      {theater.address && (
        <p className="text-gray-600 mb-1">
          📍 {theater.address}, {theater.postal_code} {theater.city}
        </p>
      )}
      {theater.screen_count != null && theater.screen_count > 0 && (
        <p className="text-gray-600">
          🎬 {theater.screen_count} salle{theater.screen_count > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}