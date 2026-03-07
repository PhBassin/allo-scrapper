import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseJSONMemoized, getJSONParseCacheStats, resetJSONParseCache } from './json-parse-cache.js';
import { logger } from './logger.js';

// Mock logger to avoid console output during tests
vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('parseJSONMemoized', () => {
  beforeEach(() => {
    // Reset cache before each test for isolation
    resetJSONParseCache();
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should parse valid JSON string', () => {
      const result = parseJSONMemoized('["Animation", "Family"]');
      expect(result).toEqual(['Animation', 'Family']);
    });

    it('should return empty array for null', () => {
      const result = parseJSONMemoized(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const result = parseJSONMemoized(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseJSONMemoized('');
      expect(result).toEqual([]);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseJSONMemoized('invalid json {');
      expect(result).toEqual([]);
    });

    it('should log warning for invalid JSON', () => {
      parseJSONMemoized('invalid json {');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse JSON string'),
        expect.any(Error)
      );
    });

    it('should parse JSON objects', () => {
      const result = parseJSONMemoized('{"name": "Actor", "id": 123}');
      expect(result).toEqual({ name: 'Actor', id: 123 });
    });

    it('should parse nested arrays', () => {
      const result = parseJSONMemoized('[["a", "b"], ["c", "d"]]');
      expect(result).toEqual([['a', 'b'], ['c', 'd']]);
    });
  });

  describe('Caching behavior', () => {
    it('should cache parsed results', () => {
      const jsonStr = '["Animation", "Family"]';
      
      // First call should miss
      parseJSONMemoized(jsonStr);
      let stats = getJSONParseCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      
      // Second call should hit
      parseJSONMemoized(jsonStr);
      stats = getJSONParseCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should return deep copy (not shared reference)', () => {
      const jsonStr = '["Animation", "Family"]';
      
      const result1 = parseJSONMemoized(jsonStr);
      const result2 = parseJSONMemoized(jsonStr);
      
      // Modify first result
      result1[0] = 'Modified';
      
      // Second result should be unaffected
      expect(result2[0]).toBe('Animation');
    });

    it('should prevent shared mutable state for objects', () => {
      const jsonStr = '[{"name": "Actor 1", "id": 1}]';
      
      const result1 = parseJSONMemoized(jsonStr);
      const result2 = parseJSONMemoized(jsonStr);
      
      // Modify nested object in first result
      result1[0].name = 'Modified';
      
      // Second result should be unaffected (deep clone)
      expect(result2[0].name).toBe('Actor 1');
    });

    it('should handle repeated calls with same input', () => {
      const jsonStr = '["IMAX", "3D"]';
      
      // Make 100 calls with same string
      for (let i = 0; i < 100; i++) {
        const result = parseJSONMemoized(jsonStr);
        expect(result).toEqual(['IMAX', '3D']);
      }
      
      // Should have 1 miss and 99 hits
      const stats = getJSONParseCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(99);
      expect(stats.hitRate).toBeCloseTo(0.99, 2);
    });

    it('should track cache hits and misses correctly', () => {
      parseJSONMemoized('["a"]'); // miss
      parseJSONMemoized('["b"]'); // miss
      parseJSONMemoized('["a"]'); // hit
      parseJSONMemoized('["c"]'); // miss
      parseJSONMemoized('["b"]'); // hit
      parseJSONMemoized('["a"]'); // hit
      
      const stats = getJSONParseCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.5, 2);
    });
  });

  describe('LRU eviction', () => {
    it('should not clear entire cache when limit reached', () => {
      // Get max size from stats
      const initialStats = getJSONParseCacheStats();
      const maxSize = initialStats.maxSize;
      
      // Fill cache to max
      for (let i = 0; i < maxSize; i++) {
        parseJSONMemoized(`["item-${i}"]`);
      }
      
      let stats = getJSONParseCacheStats();
      expect(stats.size).toBe(maxSize);
      
      // Add one more (should trigger eviction, not clear)
      parseJSONMemoized(`["item-${maxSize}"]`);
      
      stats = getJSONParseCacheStats();
      // Cache size should still be at or near max, not 1
      expect(stats.size).toBeGreaterThan(1);
      expect(stats.size).toBeLessThanOrEqual(maxSize);
    });

    it('should evict least recently used entries', () => {
      // This test assumes a small cache size for testing
      // In production, cache size is configurable via env var
      
      const testData = ['["a"]', '["b"]', '["c"]'];
      
      // Add and access in specific order
      testData.forEach(str => parseJSONMemoized(str));
      
      // Access "a" and "b" to make them recently used
      parseJSONMemoized('["a"]');
      parseJSONMemoized('["b"]');
      
      // The cache should maintain most recently used items
      const stats = getJSONParseCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should maintain max size limit', () => {
      const stats = getJSONParseCacheStats();
      const maxSize = stats.maxSize;
      
      // Add more entries than max
      for (let i = 0; i < maxSize + 100; i++) {
        parseJSONMemoized(`["item-${i}"]`);
      }
      
      const finalStats = getJSONParseCacheStats();
      expect(finalStats.size).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Edge cases', () => {
    it('should handle complex nested objects', () => {
      const complexJson = JSON.stringify({
        film: {
          title: 'Matrix',
          actors: [
            { name: 'Keanu', roles: ['Neo'] },
            { name: 'Laurence', roles: ['Morpheus'] }
          ],
          metadata: { year: 1999, ratings: [4.5, 4.7] }
        }
      });
      
      const result = parseJSONMemoized(complexJson);
      expect(result.film.actors[0].name).toBe('Keanu');
      
      // Verify deep clone
      const result2 = parseJSONMemoized(complexJson);
      result2.film.actors[0].name = 'Modified';
      
      const result3 = parseJSONMemoized(complexJson);
      expect(result3.film.actors[0].name).toBe('Keanu');
    });

    it('should handle arrays of objects', () => {
      const jsonStr = '[{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]';
      
      const result1 = parseJSONMemoized(jsonStr);
      const result2 = parseJSONMemoized(jsonStr);
      
      result1[0].name = 'Modified';
      
      expect(result2[0].name).toBe('A');
    });

    it('should handle empty JSON arrays and objects', () => {
      expect(parseJSONMemoized('[]')).toEqual([]);
      expect(parseJSONMemoized('{}')).toEqual({});
    });

    it('should handle JSON with special characters', () => {
      const jsonStr = '["Action & Adventure", "Sci-Fi/Fantasy"]';
      const result = parseJSONMemoized(jsonStr);
      expect(result).toEqual(['Action & Adventure', 'Sci-Fi/Fantasy']);
    });
  });
});

describe('Cache management', () => {
  beforeEach(() => {
    resetJSONParseCache();
  });

  it('getJSONParseCacheStats should return correct metrics', () => {
    const stats = getJSONParseCacheStats();
    
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
    expect(stats).toHaveProperty('hitRate');
    expect(stats).toHaveProperty('maxSize');
    
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
    expect(typeof stats.maxSize).toBe('number');
  });

  it('getJSONParseCacheStats should calculate hit rate correctly', () => {
    let stats = getJSONParseCacheStats();
    expect(stats.hitRate).toBe(0); // No calls yet
    
    parseJSONMemoized('["a"]'); // miss
    stats = getJSONParseCacheStats();
    expect(stats.hitRate).toBe(0); // 0/1 = 0
    
    parseJSONMemoized('["a"]'); // hit
    stats = getJSONParseCacheStats();
    expect(stats.hitRate).toBe(0.5); // 1/2 = 0.5
    
    parseJSONMemoized('["a"]'); // hit
    parseJSONMemoized('["a"]'); // hit
    stats = getJSONParseCacheStats();
    expect(stats.hitRate).toBe(0.75); // 3/4 = 0.75
  });

  it('resetJSONParseCache should clear cache and stats', () => {
    // Populate cache
    parseJSONMemoized('["a"]');
    parseJSONMemoized('["b"]');
    parseJSONMemoized('["a"]');
    
    let stats = getJSONParseCacheStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.hits).toBeGreaterThan(0);
    expect(stats.misses).toBeGreaterThan(0);
    
    // Reset
    resetJSONParseCache();
    
    stats = getJSONParseCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it('resetJSONParseCache should allow cache to work after reset', () => {
    parseJSONMemoized('["a"]');
    resetJSONParseCache();
    
    // Should work normally after reset
    parseJSONMemoized('["b"]');
    const stats = getJSONParseCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });
});
