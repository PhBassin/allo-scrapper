// Circuit breaker pattern for upstream failure resilience (#599)
//
// Prevents wasted requests when the upstream (allocine.fr) is down.
// After N consecutive failures the circuit "opens" and rejects requests
// immediately.  After a cooldown period a single test request is allowed
// through ("half-open").  If it succeeds the circuit "closes" again;
// if it fails the circuit stays open for another cooldown cycle.

import { logger } from '../utils/logger.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open — upstream is unavailable') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens (default 5) */
  threshold?: number;
  /** Milliseconds to wait before allowing a test request (default 60 000) */
  cooldownMs?: number;
}

export class CircuitBreaker {
  private _state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 60_000;
  }

  /** Current state of the circuit. */
  get state(): CircuitState {
    return this._state;
  }

  /** Number of consecutive failures recorded. */
  get failures(): number {
    return this.failureCount;
  }

  /**
   * Wrap an async operation with circuit breaker protection.
   *
   * @throws {CircuitOpenError} if the circuit is open and the cooldown has
   *         not elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this._state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this._state = 'half-open';
        logger.info('Circuit breaker half-open — allowing test request');
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Reset the circuit to the closed state (e.g. at the start of a new run). */
  reset(): void {
    this._state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    logger.info('Circuit breaker reset to closed');
  }

  // ── Internal helpers ────────────────────────────────────────

  private onSuccess(): void {
    if (this._state === 'half-open') {
      logger.info('Circuit breaker closed — test request succeeded');
    }
    this._state = 'closed';
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this._state === 'half-open') {
      // Test request failed → back to open
      this._state = 'open';
      logger.warn('Circuit breaker re-opened — test request failed', {
        failures: this.failureCount,
      });
      return;
    }

    if (this.failureCount >= this.threshold) {
      this._state = 'open';
      logger.warn('Circuit breaker opened', {
        failures: this.failureCount,
        threshold: this.threshold,
        cooldownMs: this.cooldownMs,
      });
    }
  }
}
