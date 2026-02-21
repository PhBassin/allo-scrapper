import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Tracer module tests
// ---------------------------------------------------------------------------

describe('tracer', () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure OTEL_EXPORTER_OTLP_ENDPOINT is set to a dummy value
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317';
  });

  it('exports an initTracing function', async () => {
    const { initTracing } = await import('../../src/utils/tracer.js');
    expect(typeof initTracing).toBe('function');
  });

  it('exports a getTracer function', async () => {
    const { getTracer } = await import('../../src/utils/tracer.js');
    expect(typeof getTracer).toBe('function');
  });

  it('initTracing does not throw when called', async () => {
    const { initTracing } = await import('../../src/utils/tracer.js');
    expect(() => initTracing()).not.toThrow();
  });

  it('getTracer returns a tracer with span-creating capability', async () => {
    const { initTracing, getTracer } = await import('../../src/utils/tracer.js');
    initTracing();
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });
});
