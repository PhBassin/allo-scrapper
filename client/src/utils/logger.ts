/**
 * Client-side logger abstraction.
 *
 * Strategy:
 *   - In development  → delegates to console.* (visible in browser DevTools)
 *   - In production   → forwards ERROR and WARN events to POST /api/logs, which
 *                       re-logs them via Winston so they appear in Loki → Grafana
 *                       alongside backend logs (tagged with source: 'client').
 *                       INFO and DEBUG are silently dropped in production to avoid
 *                       noise.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.error('Search failed', { component: 'FilmSearchBar', detail: err.message });
 *   logger.warn('Font not loaded', { font: 'CustomFont' });
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type LogContext = Record<string, unknown>;

const isDev = import.meta.env.DEV;

// Use relative path so it works both in dev (Vite proxy) and production (same origin).
const LOGS_ENDPOINT = '/api/logs';

function sendToServer(level: 'error' | 'warn', message: string, context?: LogContext): void {
  // Fire-and-forget: we intentionally do not await or handle the promise.
  // If the request fails we silently discard — the alternative (console logging
  // the failure) would defeat the purpose of this module.
  fetch(LOGS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Do NOT include credentials: the endpoint is public (no auth required).
    body: JSON.stringify({ level, message, context }),
  }).catch(() => {
    // Intentionally silent — network errors must not cause cascading failures.
  });
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console[level](message, ...(context !== undefined ? [context] : []));
    return;
  }

  // Production: only forward error and warn to the backend.
  if (level === 'error' || level === 'warn') {
    sendToServer(level, message, context);
  }
  // info and debug are silently dropped in production.
}

export const logger = {
  error: (message: string, context?: LogContext) => log('error', message, context),
  warn:  (message: string, context?: LogContext) => log('warn',  message, context),
  info:  (message: string, context?: LogContext) => log('info',  message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};
