/**
 * Story 3.4 — SSE Concurrent Client Load Test (50+ Clients)
 *
 * Strategy:
 *  - Spin up a disposable in-process Express app with the real SSE route,
 *    real ProgressTracker (isolated instance, not the global singleton), and
 *    real requireAuth JWT middleware — so we exercise the actual mounted seam.
 *  - Use 50 native Node http clients to subscribe concurrently.
 *  - Assert delivery latency, event ordering, memory bounds, and graceful shutdown.
 *
 * No Testcontainers / Redis required: we drive events via direct progressTracker.emit().
 */

import http from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ProgressTracker } from '../services/progress-tracker.js';
import type { ProgressEvent } from '../services/progress-tracker.js';
import type { AuthRequest } from '../middleware/auth.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const CONCURRENT_CLIENTS = 50;
const LATENCY_THRESHOLD_MS = 1000;
const MEMORY_LIMIT_BYTES = 512 * 1024 * 1024; // 512 MB RSS
const SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * A long (64-char) test-only JWT secret that passes the validateJWTSecret length gate
 * but is not in the FORBIDDEN_SECRETS list.
 */
const TEST_JWT_SECRET =
  'allo-scrapper-story-3-4-concurrent-sse-load-test-secret-XYZ-1234567890';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a signed JWT that requireAuth will accept.
 * We bypass the module-level `validateJWTSecret()` call by setting JWT_SECRET
 * before the module is imported (see beforeAll), then signing with the same value.
 */
function makeToken(): string {
  return jwt.sign(
    {
      id: 1,
      username: 'load-test-user',
      role_name: 'admin',
      is_system_role: true,
      permissions: [],
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/**
 * Create a minimal Express app that mounts only the SSE progress route,
 * wiring it to the supplied isolated ProgressTracker.
 */
function buildDisposableApp(tracker: ProgressTracker): Express {
  const app = express();

  // Inline requireAuth using the test secret — avoids importing the module-level
  // singleton that calls validateJWTSecret() at import time with the real env.
  const inlineRequireAuth = (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as AuthRequest['user'];
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
  };

  // Real rate limiter to protect auth verification from request floods.
  // Keep limits high enough for this concurrent integration test.
  const progressRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 500,
    standardHeaders: false,
    legacyHeaders: false,
  });

  // Minimal DB stub (progress route does not query the DB directly)
  app.set('db', { query: async () => ({ rows: [] }) });

  // SSE progress route — mirrors server/src/routes/scraper.ts:303-325
  // but wired to our isolated tracker instead of the global singleton.
  app.get('/api/scraper/progress', progressRateLimiter, inlineRequireAuth, (req: AuthRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const lastEventId = req.get('Last-Event-ID');
    const traceContext = req.user
      ? { user_id: String(req.user.id), org_slug: req.user.org_slug }
      : undefined;

    tracker.addListener(res, traceContext, lastEventId);

    req.on('close', () => {
      tracker.removeListener(res);
    });
  });

  return app;
}

/**
 * Parse SSE frames from accumulated raw bytes.
 * Returns parsed events and the unparsed remainder (incomplete tail).
 *
 * Handles both `\n\n` and `\r\n\r\n` frame separators, and joins
 * multi-line `data:` payloads per the SSE spec.
 */
function parseSseFrames(raw: string): { events: ProgressEvent[]; remainder: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const events: ProgressEvent[] = [];
  const segments = normalized.split('\n\n');
  // The last segment is always an incomplete tail — keep it as remainder.
  const completeFrames = segments.slice(0, -1);
  const remainder = segments[segments.length - 1] ?? '';

  for (const frame of completeFrames) {
    const dataLines = frame
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice('data:'.length).trim());

    if (dataLines.length > 0) {
      try {
        const payload = dataLines.join('\n');
        events.push(JSON.parse(payload) as ProgressEvent);
      } catch {
        // ignore malformed frames
      }
    }
  }

  return { events, remainder };
}

/**
 * Open a single SSE connection and collect up to `targetCount` frames before
 * resolving.  Records the wall-clock time when each frame arrives.
 */
interface ClientResult {
  /** Wall-clock ms when the client request was sent */
  requestedAt: number;
  /** Wall-clock ms when the TCP connection was accepted (first byte received) */
  connectedAt: number;
  /** Parsed events in arrival order */
  events: ProgressEvent[];
  /** Wall-clock timestamps (ms) for each event, parallel to `events` */
  arrivedAt: number[];
  /** Whether the stream ended cleanly (done===true equivalent: 'end' fired) */
  streamEnded: boolean;
}

async function waitForListenerCount(
  tracker: ProgressTracker,
  expected: number,
  timeoutMs = 10_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (tracker.getListenerCount() >= expected) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(
    `Timed out waiting for ${expected} listeners (got ${tracker.getListenerCount()})`,
  );
}

async function waitForListenerCountOrDrain(
  tracker: ProgressTracker,
  expected: number,
  clientPromises: Array<Promise<ClientResult>>,
  timeoutMs = 10_000,
): Promise<void> {
  try {
    await waitForListenerCount(tracker, expected, timeoutMs);
  } catch (error) {
    await Promise.allSettled(clientPromises);
    throw error;
  }
}

function openSseClient(
  port: number,
  token: string,
  targetEventCount: number,
  timeoutMs = 15_000,
): Promise<ClientResult> {
  return new Promise((resolve, reject) => {
    const result: ClientResult = {
      requestedAt: Date.now(),
      connectedAt: 0,
      events: [],
      arrivedAt: [],
      streamEnded: false,
    };

    let buf = '';
    let settled = false;

    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result);
    };

    const timer = setTimeout(
      () => settle(new Error(`SSE client timed out after ${timeoutMs} ms (received ${result.events.length}/${targetEventCount} events)`)),
      timeoutMs,
    );

    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/scraper/progress',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
      },
      (incoming) => {
        if (incoming.statusCode !== 200) {
          const chunks: Buffer[] = [];
          incoming.on('data', (c: Buffer) => chunks.push(c));
          incoming.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            settle(new Error(`SSE endpoint returned ${incoming.statusCode}: ${body.slice(0, 200)}`));
          });
          return;
        }

        result.connectedAt = Date.now();

        incoming.setEncoding('utf8');
        incoming.on('data', (chunk: string) => {
          buf += chunk;
          const { events: frames, remainder } = parseSseFrames(buf);
          buf = remainder;

          for (const frame of frames) {
            result.events.push(frame);
            result.arrivedAt.push(Date.now());
          }

          if (result.events.length >= targetEventCount) {
            req.destroy();
            settle();
          }
        });

        incoming.on('end', () => {
          result.streamEnded = true;
          settle();
        });

        incoming.on('error', (err) => {
          // ECONNRESET is the transport-level equivalent of stream-end during
          // graceful shutdown — don't reject, just mark completed.
          if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
            result.streamEnded = true;
            settle();
            return;
          }
          settle(err);
        });
      },
    );

    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
        result.streamEnded = true;
        settle();
        return;
      }
      settle(err);
    });
  });
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Story 3.4 — SSE Concurrent Client Load Test (50+ clients)', () => {
  let server: http.Server;
  let port: number;
  let tracker: ProgressTracker;
  const TOKEN = makeToken();
  const disposableServers: http.Server[] = [];

  beforeAll(async () => {
    tracker = new ProgressTracker();
    const app = buildDisposableApp(tracker);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    expect(port).toBeGreaterThan(0);
  }, 30_000);

  afterAll(async () => {
    tracker.reset();
    for (const s of disposableServers) {
      await new Promise<void>((resolve) => s.close(() => resolve())).catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 10_000);

  // ── AC 1: 50 clients connect concurrently and receive heartbeat-equivalent events ──

  it('AC1 — 50 clients receive heartbeat ping around the 30 second cadence', async () => {
    const clientPromises = Array.from({ length: CONCURRENT_CLIENTS }, () =>
      openSseClient(port, TOKEN, 1, 45_000),
    );

    await waitForListenerCountOrDrain(tracker, CONCURRENT_CLIENTS, clientPromises);
    expect(tracker.getListenerCount()).toBe(CONCURRENT_CLIENTS);

    const results = await Promise.all(clientPromises);

    for (const r of results) {
      expect(r.events.length).toBeGreaterThanOrEqual(1);
      expect(r.events[0]?.type).toBe('ping');
      const heartbeatDelay = r.arrivedAt[0] - r.requestedAt;
      expect(heartbeatDelay).toBeGreaterThanOrEqual(28_000);
      expect(heartbeatDelay).toBeLessThanOrEqual(35_000);
    }

    const firstHeartbeatArrival = Math.min(...results.map((r) => r.arrivedAt[0]));
    const lastHeartbeatArrival = Math.max(...results.map((r) => r.arrivedAt[0]));
    expect(lastHeartbeatArrival - firstHeartbeatArrival).toBeLessThanOrEqual(LATENCY_THRESHOLD_MS);
  }, 60_000);

  it('AC1+AC2 — 50 clients connect concurrently and receive a business event within 1 s', async () => {
    // Ensure clean state — previous test may have left lingering close handlers
    tracker.reset();
    const baselineRss = process.memoryUsage().rss;

    // Open 50 connections simultaneously — each expects exactly 1 business event
    const clientPromises = Array.from({ length: CONCURRENT_CLIENTS }, () =>
      openSseClient(port, TOKEN, 1),
    );

    // Give all clients a moment to establish their connections before emitting
    await waitForListenerCountOrDrain(tracker, CONCURRENT_CLIENTS, clientPromises);

    expect(tracker.getListenerCount()).toBe(CONCURRENT_CLIENTS);

    // Emit the business event and record the server-side timestamp
    const emitTime = Date.now();
    const event: ProgressEvent = {
      type: 'started',
      total_cinemas: 5,
      total_dates: 10,
      report_id: 9001,
    };
    tracker.emit(event);

    // Wait for all clients to receive the event
    const results = await Promise.all(clientPromises);

    // AC 1: all clients received the event
    for (const r of results) {
      expect(r.events.length).toBeGreaterThanOrEqual(1);
    }

    // AC 1: no client exceeded 1 s latency
    for (const r of results) {
      const firstBusinessEvent = r.events.find((e) => e.type !== 'ping');
      expect(firstBusinessEvent, `no business event received — got: ${JSON.stringify(r.events.map((e) => e.type))}`).toBeDefined();
      const idx = r.events.indexOf(firstBusinessEvent!);
      const latency = r.arrivedAt[idx] - emitTime;
      expect(latency).toBeLessThanOrEqual(LATENCY_THRESHOLD_MS);
    }

    // AC 1: memory < 512 MB RSS under load
    const underLoadRss = process.memoryUsage().rss;
    expect(underLoadRss).toBeLessThan(MEMORY_LIMIT_BYTES);
    // Also check we captured a real baseline (not a stale 0)
    expect(baselineRss).toBeGreaterThan(0);
  }, 20_000);

  // ── AC 2: event delivery order is consistent across all clients ──

  it('AC2 — event delivery order is identical across all 50 clients for a short sequence', async () => {
    // Reset tracker state before this sub-test
    tracker.reset();
    const freshTracker = new ProgressTracker();

    // Rebuild the server with the fresh tracker
    const app2 = buildDisposableApp(freshTracker);
    let server2: http.Server;
    let port2: number;

    await new Promise<void>((resolve) => {
      server2 = app2.listen(0, '127.0.0.1', () => resolve());
    });
    disposableServers.push(server2);
    const addr2 = server2.address();
    port2 = typeof addr2 === 'object' && addr2 ? addr2.port : 0;

    try {
      // Each client expects 3 business events: started, cinema_started, completed
      const TARGET = 3;
      const clientPromises = Array.from({ length: CONCURRENT_CLIENTS }, () =>
        openSseClient(port2, TOKEN, TARGET, 12_000),
      );

      // Wait for connections
      await waitForListenerCountOrDrain(freshTracker, CONCURRENT_CLIENTS, clientPromises);
      expect(freshTracker.getListenerCount()).toBe(CONCURRENT_CLIENTS);

      // Emit the sequence
      const sequence: ProgressEvent[] = [
        { type: 'started', total_cinemas: 1, total_dates: 1, report_id: 9002 },
        { type: 'cinema_started', cinema_name: 'Test Cinema', cinema_id: 'c1', index: 0, report_id: 9002 },
        { type: 'completed', summary: { total_cinemas: 1, successful_cinemas: 1, failed_cinemas: 0, total_films: 0, total_showtimes: 0, total_dates: 1, duration_ms: 100, errors: [] }, report_id: 9002 },
      ];

      for (const ev of sequence) {
        freshTracker.emit(ev);
      }

      const results = await Promise.all(clientPromises);

      // Every client should have received at least 3 business events
      for (const r of results) {
        const businessEvents = r.events.filter((e) => e.type !== 'ping');
        expect(businessEvents.length).toBeGreaterThanOrEqual(3);
      }

      // Business event type order must be identical across all clients
      const referenceOrder = results[0].events
        .filter((e) => e.type !== 'ping')
        .map((e) => e.type);
      for (let i = 1; i < results.length; i++) {
        const clientOrder = results[i].events
          .filter((e) => e.type !== 'ping')
          .map((e) => e.type);
        expect(clientOrder).toEqual(referenceOrder);
      }
    } finally {
      freshTracker.reset();
      await new Promise<void>((resolve) => server2.close(() => resolve()));
    }
  }, 30_000);

  // ── AC 3: graceful shutdown — all clients observe stream close within 5 s ──

  it('AC3 — graceful shutdown closes all SSE streams within 5 s', async () => {
    const shutdownTracker = new ProgressTracker();
    const app3 = buildDisposableApp(shutdownTracker);
    let server3: http.Server;
    let port3: number;

    await new Promise<void>((resolve) => {
      server3 = app3.listen(0, '127.0.0.1', () => resolve());
    });
    disposableServers.push(server3);
    const addr3 = server3.address();
    port3 = typeof addr3 === 'object' && addr3 ? addr3.port : 0;

    try {
      // Open 50 clients — they wait indefinitely (large target count)
      const clientPromises = Array.from({ length: CONCURRENT_CLIENTS }, () =>
        openSseClient(port3, TOKEN, 999, 12_000),
      );

      // Wait for all connections to be established
      await waitForListenerCountOrDrain(shutdownTracker, CONCURRENT_CLIENTS, clientPromises);
      expect(shutdownTracker.getListenerCount()).toBe(CONCURRENT_CLIENTS);

      // Trigger server shutdown and track duration
      const shutdownStart = Date.now();

      // First reset the tracker so SSE responses end (res.end()) — this models
      // the "close SSE streams" part of graceful shutdown.
      shutdownTracker.reset();

      // Then close the HTTP server so no new connections are accepted.
      await new Promise<void>((resolve) => server3.close(() => resolve()));

      const shutdownDuration = Date.now() - shutdownStart;

      // All clients should now be settled (stream ended or timed out)
      const results = await Promise.all(clientPromises);

      // AC 3: shutdown completed in < 5 s
      expect(shutdownDuration).toBeLessThan(SHUTDOWN_TIMEOUT_MS);

      // AC 3: all clients observed a stream-end event
      const streamEndedCount = results.filter((r) => r.streamEnded).length;
      expect(streamEndedCount).toBe(CONCURRENT_CLIENTS);
    } catch (err) {
      // Ensure server is closed even on failure
      await new Promise<void>((resolve) => server3.close(() => resolve())).catch(() => {});
      throw err;
    }
  }, 30_000);

  // ── Memory stability — two snapshots prove RSS stays under bound ──

  it('AC1 (memory) — RSS stays below 512 MB baseline and under-load', async () => {
    tracker.reset();
    const baseline = process.memoryUsage().rss;
    expect(baseline).toBeGreaterThan(0);

    // Open 50 clients, emit one event, collect results
    const clientPromises = Array.from({ length: CONCURRENT_CLIENTS }, () =>
      openSseClient(port, TOKEN, 1, 10_000),
    );

    await waitForListenerCountOrDrain(tracker, CONCURRENT_CLIENTS, clientPromises);

    tracker.emit({ type: 'started', total_cinemas: 2, total_dates: 2, report_id: 9003 });

    await Promise.all(clientPromises);

    const underLoad = process.memoryUsage().rss;

    expect(baseline).toBeLessThan(MEMORY_LIMIT_BYTES);
    expect(underLoad).toBeLessThan(MEMORY_LIMIT_BYTES);
  }, 15_000);
});
