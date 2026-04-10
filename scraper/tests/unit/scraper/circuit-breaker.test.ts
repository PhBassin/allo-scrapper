import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../../../src/scraper/circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
  });

  it('should execute successfully when closed', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe('closed');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('should open after reaching the failure threshold', async () => {
    const threshold = 3;
    const cb = new CircuitBreaker(threshold);

    // Fail threshold - 1 times
    for (let i = 0; i < threshold - 1; i++) {
      await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');
      expect(cb.getState()).toBe('closed');
    }

    // Fail 1 more time (reaches threshold)
    await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(cb.getState()).toBe('open');
    expect(cb.getFailureCount()).toBe(threshold);
  });

  it('should reject requests immediately when open', async () => {
    const threshold = 1;
    const cb = new CircuitBreaker(threshold);

    // Trip the circuit
    await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(cb.getState()).toBe('open');

    // Next request should fail with CircuitOpenError
    await expect(cb.execute(async () => 'success')).rejects.toThrow(CircuitOpenError);
    // Should still be open
    expect(cb.getState()).toBe('open');
  });

  it('should transition to half-open after cooldown period', async () => {
    const threshold = 1;
    const cooldownMs = 10000; // 10 seconds
    const cb = new CircuitBreaker(threshold, cooldownMs);

    // Trip the circuit
    await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(cb.getState()).toBe('open');

    // Advance time past cooldown
    vi.advanceTimersByTime(cooldownMs + 1);

    // State should now be half-open
    expect(cb.getState()).toBe('half-open');
  });

  it('should close if half-open request succeeds', async () => {
    const threshold = 1;
    const cooldownMs = 10000;
    const cb = new CircuitBreaker(threshold, cooldownMs);

    // Trip the circuit
    await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');

    // Advance time past cooldown
    vi.advanceTimersByTime(cooldownMs + 1);
    expect(cb.getState()).toBe('half-open');

    // Successful request should close the circuit
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe('closed');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('should re-open if half-open request fails', async () => {
    const threshold = 1;
    const cooldownMs = 10000;
    const cb = new CircuitBreaker(threshold, cooldownMs);

    // Trip the circuit
    await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');

    // Advance time past cooldown
    vi.advanceTimersByTime(cooldownMs + 1);
    expect(cb.getState()).toBe('half-open');

    // Failed request should re-open the circuit
    await expect(cb.execute(async () => { throw new Error('another failure'); })).rejects.toThrow('another failure');
    
    // Check that it's open again and we need another cooldown
    expect(cb.getState()).toBe('open');
    
    // Immediate subsequent request should throw CircuitOpenError
    await expect(cb.execute(async () => 'success')).rejects.toThrow(CircuitOpenError);
  });

  it('should ignore errors when isFailure returns false', async () => {
    const threshold = 1;
    const isFailure = (err: any) => err.message !== 'ignored';
    const cb = new CircuitBreaker(threshold, 60000, isFailure);

    // This error should be ignored
    await expect(cb.execute(async () => { throw new Error('ignored'); })).rejects.toThrow('ignored');
    expect(cb.getState()).toBe('closed');
    expect(cb.getFailureCount()).toBe(0);

    // This error should trip the circuit
    await expect(cb.execute(async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(cb.getState()).toBe('open');
    expect(cb.getFailureCount()).toBe(1);
  });

});
