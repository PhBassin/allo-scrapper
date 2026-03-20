import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../../../src/scraper/circuit-breaker.js';

// Suppress logger output during tests
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
  });

  it('starts in closed state', () => {
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);
  });

  it('remains closed on success', async () => {
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);
  });

  it('counts failures but stays closed below threshold', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.execute(fail)).rejects.toThrow('fail');
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(1);

    await expect(cb.execute(fail)).rejects.toThrow('fail');
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(2);
  });

  it('opens after reaching the failure threshold', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow('fail');
    }

    expect(cb.state).toBe('open');
    expect(cb.failures).toBe(3);
  });

  it('rejects immediately when open (before cooldown)', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow('fail');
    }

    // Now open — should throw CircuitOpenError without calling fn
    const fn = vi.fn();
    await expect(cb.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions to half-open after cooldown elapses', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow('fail');
    }
    expect(cb.state).toBe('open');

    // Fast-forward past cooldown
    vi.useFakeTimers();
    vi.advanceTimersByTime(1001);

    // A successful test request should close the circuit
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);

    vi.useRealTimers();
  });

  it('re-opens if the half-open test request fails', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow('fail');
    }
    expect(cb.state).toBe('open');

    vi.useFakeTimers();
    vi.advanceTimersByTime(1001);

    // Test request fails → circuit re-opens
    await expect(cb.execute(fail)).rejects.toThrow('fail');
    expect(cb.state).toBe('open');

    vi.useRealTimers();
  });

  it('resets failure count on a successful call', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    // Accumulate 2 failures (below threshold)
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.failures).toBe(2);

    // One success resets
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.failures).toBe(0);
    expect(cb.state).toBe('closed');
  });

  it('reset() forces the circuit closed', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow();
    }
    expect(cb.state).toBe('open');

    cb.reset();
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);

    // Should work again
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('uses default threshold (5) and cooldown (60s) when no options given', () => {
    const defaultCb = new CircuitBreaker();
    expect(defaultCb.state).toBe('closed');
    // We can't directly inspect private fields, but we can verify it takes
    // more than 3 failures to open
    const fail = () => Promise.reject(new Error('fail'));
    const promises = Array.from({ length: 4 }, () =>
      defaultCb.execute(fail).catch(() => {})
    );
    return Promise.all(promises).then(() => {
      expect(defaultCb.state).toBe('closed'); // still closed at 4
    });
  });
});
