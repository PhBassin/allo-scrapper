import { isIP, isIPv4 } from 'net';
import type { RequestHandler } from 'express';
import { logger } from './logger.js';
import { parseStrictInt } from './number.js';

/**
 * Trust setting when TRUST_PROXY is unset: X-Forwarded-For is ignored and req.ip is
 * the TCP peer, so no client can spoof its IP (and bypass IP-keyed rate limits).
 * Deployments behind a reverse proxy opt in by setting TRUST_PROXY.
 */
export const DEFAULT_TRUST_PROXY = false;

export type TrustProxySetting = boolean | number | string[];

const KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);

// proxy-addr rejects a /0 range and any netmask whose bits are not contiguous
function isContiguousNetmask(mask: string): boolean {
  const bits = mask.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
  const hostBits = 0xffffffff - bits;
  return bits !== 0 && (hostBits & (hostBits + 1)) === 0;
}

function isValidProxyAddress(entry: string): boolean {
  if (KEYWORDS.has(entry)) return true;

  const [address, range, ...rest] = entry.split('/');
  const family = isIP(address);
  if (family === 0 || rest.length > 0) return false;
  if (range === undefined) return true;

  if (/^\d+$/.test(range)) {
    const prefix = Number(range);
    return prefix > 0 && prefix <= (family === 4 ? 32 : 128);
  }
  // proxy-addr also accepts an IPv4 netmask, e.g. 10.0.0.0/255.0.0.0
  return family === 4 && isIPv4(range) && isContiguousNetmask(range);
}

function invalidTrustProxy(value: string): Error {
  return new Error(
    `Invalid TRUST_PROXY value '${value}'. Use true, false, a hop count, or a ` +
    `comma-separated list of IPs, CIDRs or loopback/linklocal/uniquelocal. ` +
    `See docs/guides/deployment/networking.md for details.`
  );
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

  const hops = parseStrictInt(trimmed);
  if (!Number.isNaN(hops)) {
    if (hops < 0) throw invalidTrustProxy(trimmed);
    return hops;
  }

  const entries = trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0 || !entries.every(isValidProxyAddress)) {
    throw invalidTrustProxy(trimmed);
  }
  return entries;
}

/**
 * With trust proxy off, logs once when a request carries X-Forwarded-For: either a
 * client is forging it, or the server sits behind a proxy that TRUST_PROXY does not
 * cover and every client shares the proxy's IP in the rate limiters.
 */
export function warnOnceOnUntrustedForwardedFor(): RequestHandler {
  let warned = false;
  return (req, _res, next) => {
    if (!warned && req.headers['x-forwarded-for'] !== undefined) {
      warned = true;
      logger.warn(
        'Ignoring X-Forwarded-For because TRUST_PROXY is not set. Behind a reverse proxy, ' +
        'all clients share its IP for rate limiting: set TRUST_PROXY ' +
        '(see docs/guides/deployment/networking.md).',
        { peer: req.socket.remoteAddress }
      );
    }
    next();
  };
}
