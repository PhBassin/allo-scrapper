import { isIP, isIPv4 } from 'net';

/**
 * Proxies trusted when TRUST_PROXY is unset: a reverse proxy on the host or on the
 * Docker network is honored, but a public client reaching port 3000 directly cannot
 * spoof its IP (and bypass IP-keyed rate limits) with a forged X-Forwarded-For.
 */
export const DEFAULT_TRUST_PROXY: string[] = ['loopback', 'linklocal', 'uniquelocal'];

export type TrustProxySetting = boolean | number | string[];

const KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isValidProxyAddress(entry: string): boolean {
  if (KEYWORDS.has(entry)) return true;

  const [address, range, ...rest] = entry.split('/');
  const family = isIP(address);
  if (family === 0 || rest.length > 0) return false;
  if (range === undefined) return true;

  if (/^\d+$/.test(range)) {
    return Number(range) <= (family === 4 ? 32 : 128);
  }
  // proxy-addr also accepts an IPv4 netmask, e.g. 10.0.0.0/255.0.0.0
  return family === 4 && isIPv4(range);
}

/**
 * Parses TRUST_PROXY into a value for Express's `trust proxy` setting:
 * `true`/`false`, a hop count, or a comma-separated list of IPs, CIDRs and the
 * keywords `loopback`, `linklocal`, `uniquelocal`. Throws on anything else so a
 * typo fails at startup instead of silently trusting the wrong peers.
 */
export function parseTrustProxy(value: string | undefined): TrustProxySetting {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return DEFAULT_TRUST_PROXY;

  const lower = trimmed.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const entries = trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
  const invalid = entries.filter((entry) => !isValidProxyAddress(entry));
  if (entries.length === 0 || invalid.length > 0) {
    throw new Error(
      `Invalid TRUST_PROXY value '${trimmed}'. Use true, false, a hop count, or a ` +
      `comma-separated list of IPs, CIDRs or loopback/linklocal/uniquelocal. ` +
      `See docs/guides/deployment/networking.md for details.`
    );
  }
  return entries;
}
