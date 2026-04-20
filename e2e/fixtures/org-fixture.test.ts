import { describe, expect, it, vi } from 'vitest';

import { assertFixtureCleanupSummary, assertFixtureRuntimeWithinLimit } from './org-fixture';

describe('org fixture assertions', () => {
  it('accepts runtime within the story threshold', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(10_000);

    expect(() => assertFixtureRuntimeWithinLimit(1_000)).not.toThrow();

    nowSpy.mockRestore();
  });

  it('rejects runtime above the story threshold', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(121_500);

    expect(() => assertFixtureRuntimeWithinLimit(1_000, 120_000)).toThrow();

    nowSpy.mockRestore();
  });

  it('accepts cleanup summary within the story threshold', () => {
    expect(() => assertFixtureCleanupSummary({ failed: 0, durationMs: 120 })).not.toThrow();
  });

  it('rejects cleanup failures or slow cleanup summaries', () => {
    expect(() => assertFixtureCleanupSummary({ failed: 1, durationMs: 120 })).toThrow();
    expect(() => assertFixtureCleanupSummary({ failed: 0, durationMs: 750 }, 500)).toThrow();
  });
});
