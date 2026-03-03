import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Logger module tests
// ---------------------------------------------------------------------------

describe('logger (server)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a logger instance', async () => {
    const { logger } = await import('./logger.js');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('emits service name as "ics-web" regardless of APP_NAME', async () => {
    process.env.APP_NAME = 'CustomName';
    vi.resetModules();
    const { logger } = await import('./logger.js');

    // Winston stores defaultMeta on the logger instance
    expect((logger as any).defaultMeta).toEqual({ service: 'ics-web' });
  });

  it('does not use APP_NAME env variable for the service identifier', async () => {
    process.env.APP_NAME = 'SomeOtherApp';
    vi.resetModules();
    const { logger } = await import('./logger.js');

    const serviceName = (logger as any).defaultMeta?.service;
    expect(serviceName).toBe('ics-web');
    expect(serviceName).not.toBe('SomeOtherApp');
  });

  it('service name is hardcoded and does not change when APP_NAME is unset', async () => {
    delete process.env.APP_NAME;
    vi.resetModules();
    const { logger } = await import('./logger.js');

    expect((logger as any).defaultMeta?.service).toBe('ics-web');
  });
});
