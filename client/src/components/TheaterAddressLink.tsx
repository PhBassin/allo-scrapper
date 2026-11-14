import { useId } from 'react';
import type { Theater } from '../types/index.js';
import { formatTheaterAddress, buildGoogleMapsUrl } from '../utils/theaterAddress.js';

interface TheaterAddressLinkProps {
  theater: Pick<Theater, 'name' | 'address' | 'postal_code' | 'city'>;
  className?: string;
}

/**
 * The Theater's address line (`📍 address, postal_code city`), whose text opens
 * the Theater's Google Maps place page in a new tab. The visible address is the
 * link's accessible name; the new tab is announced through `aria-describedby`
 * pointing to a hidden hint outside the link, so copying the address copies
 * nothing else. Renders nothing when the Theater has no address part at all.
 */
export default function TheaterAddressLink({ theater, className }: TheaterAddressLinkProps) {
  const hintId = useId();
  const formatted = formatTheaterAddress(theater);
  if (!formatted) return null;

  return (
    <p className={className}>
      📍{' '}
      <a
        href={buildGoogleMapsUrl(theater.name, formatted)}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={hintId}
        className="hover:underline"
      >
        {formatted}
      </a>
      <span id={hintId} hidden>
        ouvre Google Maps dans un nouvel onglet
      </span>
    </p>
  );
}
