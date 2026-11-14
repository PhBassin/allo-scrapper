import type { Theater } from '../../types/index.js';
import TheaterAddressLink from '../TheaterAddressLink.js';

interface TheaterHeaderProps {
  theater: Theater;
}

export function TheaterHeader({ theater }: TheaterHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{theater.name}</h1>
      <TheaterAddressLink theater={theater} className="text-gray-600 mb-1" />
    </div>
  );
}