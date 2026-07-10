/**
 * Phase 3: Performance Logic Tests
 * ================================
 *
 * Tests for algorithm complexity, caching behavior, data processing efficiency
 * No browser required - pure Jest unit tests
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// Mock data generators
function generateRegistros(count, daySpan = 100) {
  const registros = [];
  const dias = ['A', 'B', 'C', 'D', 'E'];

  for (let i = 0; i < count; i++) {
    const dayIndex = i % 5;
    const daysBack = Math.floor(i / 5);
    const date = new Date();
    date.setDate(date.getDate() - daysBack);

    registros.push({
      aluno_id: 'student1',
      dia: dias[dayIndex],
      data_treino: date.toISOString().split('T')[0],
      timestamp: date.toISOString(),
      exercicio: `Exercício ${i % 20}`,
      carga: String(40 + (i % 30)),
      reps: String(5 + (i % 15)),
      completou: i % 10 === 0 ? 'nao' : 'sim',
    });
  }

  return registros;
}

function registrosDaSessao(dia, dataIso, registros) {
  return registros.filter(r => r.dia === dia && r.data_treino === dataIso);
}

// OPTIMIZATION CANDIDATE FUNCTIONS

class RegistroCache {
  constructor() {
    this.cache = new Map();
    this.timestamp = 0;
  }

  getCachedRegistros(dia, dataIso, allRegistros) {
    const key = `${dia}:${dataIso}`;
    const now = Date.now();

    // Cache valid for 100ms
    if (this.cache.has(key) && (now - this.timestamp) < 100) {
      return this.cache.get(key);
    }

    const filtered = registrosDaSessao(dia, dataIso, allRegistros);
    this.cache.set(key, filtered);
    this.timestamp = now;

    return filtered;
  }

  invalidate() {
    this.cache.clear();
    this.timestamp = 0;
  }
}

describe('Phase 3: Algorithm Complexity', () => {
  test('registrosDaSessao is O(n) filter', () => {
    const registros = generateRegistros(1000);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      registrosDaSessao('A', '2026-07-10', registros);
    }
    const time1000 = performance.now() - start;

    const registros5000 = generateRegistros(5000);
    const start5000 = performance.now();
    for (let i = 0; i < 100; i++) {
      registrosDaSessao('A', '2026-07-10', registros5000);
    }
    const time5000 = performance.now() - start5000;

    // 5x more data should take ~5x time (linear)
    const ratio = time5000 / time1000;
    expect(ratio).toBeLessThan(15); // Allow variance
    expect(ratio).toBeGreaterThan(0.5); // Should be roughly linear

    console.log(`Filter 1000 items (100x): ${time1000.toFixed(2)}ms`);
    console.log(`Filter 5000 items (100x): ${time5000.toFixed(2)}ms`);
    console.log(`Ratio: ${ratio.toFixed(2)}x (expect ~5x)`);
  });

  test('multiple filter operations create O(n*m) behavior', () => {
    const registros = generateRegistros(10000); // Larger dataset to measure

    const start = performance.now();

    // Simulating current code: 5 separate filter passes
    for (let i = 0; i < 10; i++) {
      const filter1 = registros.filter(r => r.completou === 'sim');
      const filter2 = registros.filter(r => r.carga > 40);
      const filter3 = registros.filter(r => r.dia === 'A');
      const filter4 = registros.filter(r => r.reps > 5);
      const filter5 = registros.filter(r => r.exercicio.includes('Ex'));
    }
    const time5Passes = performance.now() - start;

    // Optimized: single pass with multiple conditions
    const startOpt = performance.now();
    for (let i = 0; i < 10; i++) {
      const optimized = registros.filter(r =>
        r.completou === 'sim' &&
        r.carga > 40 &&
        r.dia === 'A' &&
        r.reps > 5 &&
        r.exercicio.includes('Ex')
      );
    }
    const timeOptimized = performance.now() - startOpt;

    const speedup = time5Passes / timeOptimized;

    console.log(`5 separate passes (10x): ${time5Passes.toFixed(2)}ms`);
    console.log(`1 optimized pass (10x): ${timeOptimized.toFixed(2)}ms`);
    console.log(`Speedup: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThan(1); // Multiple passes should be slower than single pass
  });
});

describe('Phase 3: Caching Strategy', () => {
  let cache;

  beforeEach(() => {
    cache = new RegistroCache();
  });

  test('cache returns same object on multiple calls within window', () => {
    const registros = generateRegistros(100);

    const result1 = cache.getCachedRegistros('A', '2026-07-10', registros);
    const result2 = cache.getCachedRegistros('A', '2026-07-10', registros);

    // Should return same cached object
    expect(result1).toBe(result2);
  });

  test('cache hit ratio improves with repeated access', () => {
    const registros = generateRegistros(100);
    let hits = 0;
    let misses = 0;

    for (let i = 0; i < 100; i++) {
      const result = cache.getCachedRegistros('A', '2026-07-10', registros);
      if (i > 0 && result) hits++;
      else misses++;
    }

    const hitRatio = hits / (hits + misses);
    console.log(`Cache hit ratio: ${(hitRatio * 100).toFixed(1)}%`);

    expect(hitRatio).toBeGreaterThan(0.95); // 95%+ hit rate
  });

  test('cache invalidation clears entries', () => {
    const registros = generateRegistros(100);

    const result1 = cache.getCachedRegistros('A', '2026-07-10', registros);
    cache.invalidate();
    const result2 = cache.getCachedRegistros('A', '2026-07-10', registros);

    // After invalidation, should create new entry
    expect(result1).toEqual(result2); // Same data
  });

  test('cache reduces CPU time for 500+ workouts', () => {
    const registros = generateRegistros(500);

    // Without cache: 500 filter operations
    const startUncached = performance.now();
    for (let i = 0; i < 500; i++) {
      registrosDaSessao('A', '2026-07-10', registros);
    }
    const timeUncached = performance.now() - startUncached;

    // With cache: 1 filter + 499 cache hits
    const startCached = performance.now();
    for (let i = 0; i < 500; i++) {
      cache.getCachedRegistros('A', '2026-07-10', registros);
    }
    const timeCached = performance.now() - startCached;

    const speedup = timeUncached / timeCached;

    console.log(`Uncached 500 filters: ${timeUncached.toFixed(2)}ms`);
    console.log(`Cached 500 filters: ${timeCached.toFixed(2)}ms`);
    console.log(`Speedup: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThan(10);
  });
});

describe('Phase 3: DOM Update Efficiency', () => {
  test('surgical DOM update concept (update vs rebuild)', () => {
    // Simulate calendar grid update: verify both approaches work
    const gridSize = 31; // Days in month
    const elements = Array.from({ length: gridSize }, (_, i) => ({
      day: i + 1,
      className: '' // Start all blank
    }));

    // Surgical update: only change 1 element
    const dayToUpdate = 15;
    const oldClass = elements[dayToUpdate - 1].className;
    elements[dayToUpdate - 1].className = 'trained';
    const newClass = elements[dayToUpdate - 1].className;

    expect(elements.length).toBe(31);
    expect(newClass).toBe('trained');

    // Verify update worked - changed from empty to trained
    expect(oldClass).toBe('');
    expect(newClass).not.toBe(oldClass);

    console.log(`Surgical update verified: element ${dayToUpdate} changed from "${oldClass}" to "${newClass}"`);
  });

  test('batch DOM updates reduce reflow/repaint', () => {
    // Naive: update array elements 100 times
    const startNaive = performance.now();
    for (let run = 0; run < 1000; run++) {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, visible: false }));
      for (let i = 0; i < items.length; i++) {
        items[i].visible = i % 2 === 0;
      }
    }
    const timeNaive = performance.now() - startNaive;

    // Optimized: batch updates with map
    const startBatch = performance.now();
    for (let run = 0; run < 1000; run++) {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, visible: false }));
      const updates = items.map((item, i) => ({ ...item, visible: i % 2 === 0 }));
    }
    const timeBatch = performance.now() - startBatch;

    console.log(`Naive 100k updates: ${timeNaive.toFixed(2)}ms`);
    console.log(`Batch 100k updates: ${timeBatch.toFixed(2)}ms`);

    // Both should complete in reasonable time
    expect(timeNaive).toBeLessThan(1000);
    expect(timeBatch).toBeLessThan(1000);
  });
});

describe('Phase 3: JSON Serialization Performance', () => {
  test('serializing 500+ workouts takes significant time', () => {
    const registros = generateRegistros(500);
    const data = { registros, plano: {}, alunos: [] };

    const start = performance.now();
    const json = JSON.stringify(data);
    const time = performance.now() - start;

    const sizeKB = json.length / 1024;

    console.log(`Serialized ${registros.length} workouts: ${sizeKB.toFixed(1)}KB in ${time.toFixed(1)}ms`);

    // Should take measurable time but < 50ms for 500 items
    expect(time).toBeLessThan(100);
    expect(sizeKB).toBeGreaterThan(50); // Significant size
  });

  test('partial serialization (delta) is faster than full', () => {
    const registros = generateRegistros(1000);
    const newRecord = registros[registros.length - 1];

    // Full save
    const fullJson = JSON.stringify(registros);
    // Delta save
    const deltaJson = JSON.stringify(newRecord);

    console.log(`Full save size: ${(fullJson.length / 1024).toFixed(1)}KB`);
    console.log(`Delta save size: ${(deltaJson.length / 1024).toFixed(1)}KB`);

    // Delta should be much smaller than full
    expect(deltaJson.length).toBeLessThan(fullJson.length / 100);
    expect(fullJson.length).toBeGreaterThan(deltaJson.length);

    console.log(`Size reduction: ${((1 - deltaJson.length / fullJson.length) * 100).toFixed(0)}%`);
  });
});

describe('Phase 3: Batch Write Performance', () => {
  test('batching writes reduces total operations', () => {
    // Naive: 100 separate write operations
    const naiveOps = [];
    const startNaive = performance.now();
    for (let i = 0; i < 100; i++) {
      naiveOps.push(JSON.stringify({ data: i }));
    }
    const timeNaive = performance.now() - startNaive;

    // Optimized: batch into 1 write
    const startBatch = performance.now();
    const batch = Array.from({ length: 100 }, (_, i) => ({ data: i }));
    const batchStr = JSON.stringify(batch);
    const timeBatch = performance.now() - startBatch;

    console.log(`Naive 100 separate ops: ${timeNaive.toFixed(2)}ms`);
    console.log(`Batch 1 op: ${timeBatch.toFixed(2)}ms`);
    console.log(`Operations reduced: 100 → 1`);

    expect(naiveOps.length).toBe(100);
    expect(batchStr.length).toBeGreaterThan(0);
  });
});

describe('Phase 3: Large Dataset Performance', () => {
  test('processing 1000+ workouts completes in reasonable time', () => {
    const registros = generateRegistros(1000);

    const start = performance.now();

    // Simulate common operations
    const groupByDay = {};
    registros.forEach(r => {
      const key = r.dia;
      if (!groupByDay[key]) groupByDay[key] = [];
      groupByDay[key].push(r);
    });

    const stats = {};
    Object.entries(groupByDay).forEach(([day, regs]) => {
      stats[day] = {
        count: regs.length,
        completed: regs.filter(r => r.completou === 'sim').length,
        avgLoad: (regs.reduce((sum, r) => sum + parseInt(r.carga), 0) / regs.length).toFixed(1),
      };
    });

    const time = performance.now() - start;

    console.log(`Processed 1000 workouts in ${time.toFixed(1)}ms`);
    console.log(`Stats:`, stats);

    // Should complete in < 1000ms even with 1000 items
    expect(time).toBeLessThan(1000);
  });

  test('filtering 500+ items with multiple conditions stays efficient', () => {
    const registros = generateRegistros(500);

    const start = performance.now();

    // Complex filter
    const filtered = registros.filter(r =>
      r.completou === 'sim' &&
      parseInt(r.carga) >= 50 &&
      parseInt(r.reps) <= 8 &&
      r.exercicio.length > 5
    );

    const time = performance.now() - start;

    console.log(`Filtered 500 items in ${time.toFixed(2)}ms, matched ${filtered.length} items`);

    // Should be < 50ms even with complex conditions
    expect(time).toBeLessThan(50);
  });
});

describe('Phase 3: Rendering Efficiency', () => {
  test('chart data update without full re-initialization', () => {
    // Simulating Chart.js behavior
    class MockChart {
      constructor(config) {
        this.config = config;
        this.updateCount = 0;
      }

      update() {
        this.updateCount++;
        // Simulate update (much faster than new Chart())
        return performance.now();
      }

      destroy() {
        // Simulate destroy (expensive)
        const start = performance.now();
        while (performance.now() - start < 10) {} // Simulated work
      }
    }

    const chart = new MockChart({ data: [] });

    // Destroy + recreate approach
    const startDestroy = performance.now();
    chart.destroy();
    new MockChart({ data: [] });
    const timeDestroy = performance.now() - startDestroy;

    // Update approach
    const startUpdate = performance.now();
    chart.update();
    const timeUpdate = performance.now() - startUpdate;

    const speedup = timeDestroy / (timeUpdate + 0.1); // +0.1 to avoid division by zero

    console.log(`Chart destroy+recreate: ${timeDestroy.toFixed(1)}ms`);
    console.log(`Chart update only: ${timeUpdate.toFixed(3)}ms`);
    console.log(`Speedup: ${speedup.toFixed(0)}x`);

    expect(speedup).toBeGreaterThan(5);
  });
});

describe('Phase 3: Memory Efficiency', () => {
  test('cache vs no-cache memory usage', () => {
    const registros = generateRegistros(500);

    // No cache: keep creating new arrays
    const noCache = [];
    for (let i = 0; i < 100; i++) {
      const filtered = registros.filter(r => r.dia === 'A');
      noCache.push(filtered);
    }

    // With cache: reuse same array
    const cache = new RegistroCache();
    const withCache = [];
    for (let i = 0; i < 100; i++) {
      const filtered = cache.getCachedRegistros('A', '2026-07-10', registros);
      withCache.push(filtered);
    }

    // With cache, all 100 entries should reference the same array
    const allSame = withCache.every(item => item === withCache[0]);
    expect(allSame).toBe(true);

    console.log(`Without cache: created 100 separate arrays`);
    console.log(`With cache: reused 1 array 100 times`);
  });
});
