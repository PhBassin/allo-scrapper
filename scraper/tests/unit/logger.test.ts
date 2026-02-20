import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Logger tests
// ---------------------------------------------------------------------------

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a logger instance with standard log methods', async () => {
    const { logger } = await import('../../src/utils/logger.js');

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('logger.info does not throw', async () => {
    const { logger } = await import('../../src/utils/logger.js');
    expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
  });

  it('logger.warn does not throw', async () => {
    const { logger } = await import('../../src/utils/logger.js');
    expect(() => logger.warn('test warning')).not.toThrow();
  });

  it('logger.error does not throw', async () => {
    const { logger } = await import('../../src/utils/logger.js');
    expect(() => logger.error('test error', new Error('boom'))).not.toThrow();
  });

  it('logger.debug does not throw', async () => {
    const { logger } = await import('../../src/utils/logger.js');
    expect(() => logger.debug('test debug')).not.toThrow();
  });

  it('uses LOG_LEVEL env var when set', async () => {
    process.env.LOG_LEVEL = 'debug';
    const { logger } = await import('../../src/utils/logger.js');
    expect(logger.level).toBe('debug');
    delete process.env.LOG_LEVEL;
  });

  it('defaults to info level when LOG_LEVEL not set', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('../../src/utils/logger.js');
    expect(logger.level).toBe('info');
  });
});
