import { describe, it, expect } from 'vitest';
import { parseJSONMemoized, resetJSONParseCache, getJSONParseCacheStats } from './json-parse-cache.js';

/**
 * Performance benchmark for JSON parse cache
 * 
 * This benchmark simulates realistic database query scenarios where:
 * - Same JSON strings appear repeatedly across many rows (high repetition)
 * - We're parsing genres, actors, and experiences fields
 * 
 * Typical scenario: 1000 films with 50 showtimes each = 50,000 rows
 * but only ~500 unique combinations of genres/actors/experiences
 */
describe('JSON Parse Cache Benchmark', () => {
  it('should demonstrate cache performance improvement', () => {
    resetJSONParseCache();
    
    // Realistic test data representing common database values
    const testGenres = [
      '["Action", "Thriller"]',
      '["Animation", "Family"]',
      '["Comedy", "Romance"]',
      '["Drama"]',
      '["Science Fiction", "Action"]',
      '["Horror", "Thriller"]',
      '["Documentary"]',
      '["Fantasy", "Adventure"]',
    ];
    
    const testExperiences = [
      '["IMAX", "3D"]',
      '["IMAX"]',
      '["3D"]',
      '["Dolby Atmos"]',
      '[]',
    ];
    
    const testActors = [
      '["Tom Hanks", "Robin Wright"]',
      '["Scarlett Johansson", "Adam Driver"]',
      '["Timothée Chalamet", "Zendaya"]',
      '[]',
    ];
    
    // Simulate 50,000 database rows (typical weekly data)
    // Each "film" appears in multiple showtimes across cinemas
    const iterations = 50000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // Simulate parsing a showtime row with film data
      const genreIndex = i % testGenres.length;
      const expIndex = i % testExperiences.length;
      const actorIndex = i % testActors.length;
      
      parseJSONMemoized(testGenres[genreIndex]);
      parseJSONMemoized(testExperiences[expIndex]);
      parseJSONMemoized(testActors[actorIndex]);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const stats = getJSONParseCacheStats();
    
    // Calculate performance metrics
    const totalParses = iterations * 3; // 3 fields per row
    // Note: '[]' appears in both testExperiences and testActors (deduped by cache)
    const actualUniqueStrings = stats.size; // Use actual cache size
    const expectedHits = totalParses - actualUniqueStrings;
    const hitRatePercent = (stats.hitRate * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 JSON Parse Cache Benchmark Results');
    console.log('='.repeat(70));
    console.log(`\nScenario: Simulating ${iterations.toLocaleString()} database rows`);
    console.log(`          (3 JSON fields per row = ${totalParses.toLocaleString()} total parses)\n`);
    
    console.log('Performance:');
    console.log(`  ⏱️  Total time: ${duration.toFixed(2)}ms`);
    console.log(`  ⚡ Avg per parse: ${(duration / totalParses * 1000).toFixed(2)}µs`);
    console.log(`  🚀 Throughput: ${(totalParses / (duration / 1000)).toFixed(0)} parses/sec\n`);
    
    console.log('Cache Efficiency:');
    console.log(`  ✅ Cache hits: ${stats.hits.toLocaleString()} (${hitRatePercent}%)`);
    console.log(`  ❌ Cache misses: ${stats.misses.toLocaleString()}`);
    console.log(`  📦 Cache size: ${stats.size} / ${stats.maxSize} entries\n`);
    
    console.log('Theoretical Impact:');
    const savedParses = stats.hits;
    const estimatedSavingsMs = savedParses * 0.005; // ~5µs per JSON.parse saved
    console.log(`  💰 JSON.parse calls avoided: ${savedParses.toLocaleString()}`);
    console.log(`  📉 Estimated time saved: ~${estimatedSavingsMs.toFixed(1)}ms\n`);
    
    console.log('Real-World Context:');
    console.log(`  This simulates a typical GET /api/films or GET /api/showtimes response`);
    console.log(`  where the same genres/actors/experiences appear across many rows.`);
    console.log(`  The cache reduces redundant CPU work during database result mapping.\n`);
    console.log('='.repeat(70) + '\n');
    
    // Assertions to ensure benchmark validity
    expect(stats.size).toBeGreaterThan(0); // Should have cached entries
    expect(stats.size).toBeLessThanOrEqual(20); // Should be ~16-17 unique strings
    expect(stats.misses).toBe(actualUniqueStrings); // First occurrence of each unique string
    expect(stats.hits).toBe(expectedHits); // All subsequent occurrences
    expect(stats.hitRate).toBeGreaterThan(0.99); // >99% hit rate expected
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should show cache efficiency with varying data distribution', () => {
    resetJSONParseCache();
    
    // Test with different hit rate scenarios
    const scenarios = [
      { name: '90% repetition (high hit rate)', uniqueCount: 100, totalCalls: 1000 },
      { name: '50% repetition (medium hit rate)', uniqueCount: 500, totalCalls: 1000 },
      { name: '10% repetition (low hit rate)', uniqueCount: 900, totalCalls: 1000 },
    ];
    
    console.log('\n' + '='.repeat(70));
    console.log('📈 Cache Efficiency Under Different Scenarios');
    console.log('='.repeat(70) + '\n');
    
    scenarios.forEach(scenario => {
      resetJSONParseCache();
      
      const startTime = performance.now();
      for (let i = 0; i < scenario.totalCalls; i++) {
        const index = i % scenario.uniqueCount;
        parseJSONMemoized(`["item-${index}"]`);
      }
      const duration = performance.now() - startTime;
      const stats = getJSONParseCacheStats();
      
      console.log(`${scenario.name}:`);
      console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`  Time: ${duration.toFixed(2)}ms`);
      console.log(`  Cache size: ${stats.size} entries\n`);
    });
    
    console.log('='.repeat(70) + '\n');
  });

  it('should compare cached vs uncached performance', () => {
    // Baseline: pure JSON.parse without caching
    const testData = Array.from({ length: 100 }, (_, i) => `["item-${i % 10}"]`);
    
    // Uncached (pure JSON.parse)
    const uncachedStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      JSON.parse(testData[i % 100]);
    }
    const uncachedDuration = performance.now() - uncachedStart;
    
    // Cached (parseJSONMemoized)
    resetJSONParseCache();
    const cachedStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      parseJSONMemoized(testData[i % 100]);
    }
    const cachedDuration = performance.now() - cachedStart;
    
    const speedup = uncachedDuration / cachedDuration;
    const stats = getJSONParseCacheStats();
    
    console.log('\n' + '='.repeat(70));
    console.log('⚡ Direct Performance Comparison');
    console.log('='.repeat(70));
    console.log(`\nTest: 10,000 parses of 100 strings (90% hit rate expected)\n`);
    console.log(`Uncached (JSON.parse):       ${uncachedDuration.toFixed(2)}ms`);
    console.log(`Cached (parseJSONMemoized):  ${cachedDuration.toFixed(2)}ms`);
    console.log(`\nSpeedup: ${speedup.toFixed(2)}x faster with caching`);
    console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%\n`);
    console.log('='.repeat(70) + '\n');
    
    // The cached version should be faster (though results may vary)
    // We don't assert this since performance can be inconsistent in CI
    expect(stats.hitRate).toBeGreaterThan(0.8);
  });
});
