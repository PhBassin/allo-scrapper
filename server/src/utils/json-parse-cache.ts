import { LRUCache } from 'lru-cache';
import { logger } from './logger.js';

/**
 * Get cache size from environment variable or use default
 * Default: 10000 entries
 * Override with JSON_PARSE_CACHE_SIZE env var
 */
const getCacheSize = (): number => {
  const envSize = process.env.JSON_PARSE_CACHE_SIZE;
  if (envSize) {
    const parsed = parseInt(envSize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    logger.warn(`Invalid JSON_PARSE_CACHE_SIZE value: ${envSize}. Using default 10000.`);
  }
  return 10000;
};

// LRU cache with configurable max size
// Uses LRU eviction strategy - no cache cliffs!
const jsonParseCache = new LRUCache<string, any>({ 
  max: getCacheSize() 
});

// Metrics tracking for observability
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Memoized JSON.parse for frequently repeated JSON strings in database rows.
 * 
 * During high-volume queries (like getWeeklyFilms or getShowtimesByDate),
 * fields stored as JSON strings (genres, actors, experiences) are often
 * repeated across many rows. This cache eliminates redundant parsing.
 * 
 * Features:
 * - LRU eviction strategy (no cache cliffs)
 * - Deep cloning via structuredClone (prevents shared mutable state)
 * - Configurable cache size via JSON_PARSE_CACHE_SIZE env var
 * - Metrics tracking for observability
 * 
 * @param jsonStr - JSON string to parse (or null/undefined)
 * @returns Parsed JSON value (deep cloned), or empty array for null/undefined/invalid
 * 
 * @example
 * // Typical usage in database queries
 * const genres = parseJSONMemoized(row.genres); // ["Animation", "Family"]
 * const experiences = parseJSONMemoized(row.experiences); // ["IMAX", "3D"]
 */
export function parseJSONMemoized(jsonStr: string | null | undefined): any {
  // Handle null/undefined/empty string
  if (!jsonStr) {
    return [];
  }

  // Check cache (LRU will automatically update access order)
  if (jsonParseCache.has(jsonStr)) {
    cacheHits++;
    const cached = jsonParseCache.get(jsonStr);
    // Return deep clone to prevent shared mutable state across DB rows
    return structuredClone(cached);
  }

  // Cache miss - parse and store
  cacheMisses++;
  try {
    const parsed = JSON.parse(jsonStr);
    jsonParseCache.set(jsonStr, parsed);
    // Return deep clone to prevent shared mutable state
    return structuredClone(parsed);
  } catch (error) {
    logger.warn(`Failed to parse JSON string: ${jsonStr}`, error);
    return [];
  }
}

/**
 * Get cache statistics for observability and monitoring.
 * 
 * Useful for:
 * - Monitoring cache effectiveness (hit rate)
 * - Tuning cache size
 * - Debugging performance issues
 * 
 * @returns Cache statistics object
 * 
 * @example
 * const stats = getJSONParseCacheStats();
 * console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
 */
export function getJSONParseCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    size: jsonParseCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
    maxSize: jsonParseCache.max,
  };
}

/**
 * Reset cache and statistics.
 * 
 * Primarily for testing (test isolation), but can also be used
 * to clear cache in production if needed (e.g., after config change).
 * 
 * @example
 * // In tests
 * beforeEach(() => {
 *   resetJSONParseCache();
 * });
 */
export function resetJSONParseCache() {
  jsonParseCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}
