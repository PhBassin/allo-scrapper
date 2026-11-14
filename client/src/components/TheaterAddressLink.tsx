import type { Theater } from '../types/index.js';
import { formatTheaterAddress, buildGoogleMapsUrl } from '../utils/theaterAddress.js';

interface TheaterAddressLinkProps {
  theater: Pick<Theater, 'name' | 'address' | 'postal_code' | 'city'>;
  className?: string;
}

/**
 * The Theater's address line (`📍 address, postal_code city`), whose text opens
 * the Theater's Google Maps place page in a new tab (announced to screen
 * readers by a visually hidden suffix). Renders nothing when the
 * Theater has no address part at all.
 */
export default function TheaterAddressLink({ theater, className }: TheaterAddressLinkProps) {
  const formatted = formatTheaterAddress(theater);
  if (!formatted) return null;

  return (
    <p className={className}>
      📍{' '}
      <a
        href={buildGoogleMapsUrl(theater)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        {formatted}{' '}
        <span className="sr-only">(ouvre Google Maps dans un nouvel onglet)</span>
      </a>
    </p>
  );
}
