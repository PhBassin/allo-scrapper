import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStrategyByUrl, getStrategyBySource } from '../../../src/scraper/strategy-factory.js';

describe('Strategy Factory', () => {
  it('should return AllocineScraperStrategy for valid Allocine URLs', () => {
    const url = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html';
    const strategy = getStrategyByUrl(url);
    expect(strategy.sourceName).toBe('allocine');
  });

  it('should throw error for unknown URLs', () => {
    const url = 'https://www.google.com';
    expect(() => getStrategyByUrl(url)).toThrow(/no scraper strategy found for url/i);
  });

  it('should return AllocineScraperStrategy for source "allocine"', () => {
    const strategy = getStrategyBySource('allocine');
    expect(strategy.sourceName).toBe('allocine');
  });

  it('should throw error for unknown sources', () => {
    expect(() => getStrategyBySource('unknown')).toThrow(/no scraper strategy found for source: unknown/i);
  });
});
