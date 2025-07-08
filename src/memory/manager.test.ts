/**
 * Unit tests for Memory Manager
 */

import { MemoryManager } from './manager';
import { MemoryPoolConfig } from '../types/memory.types';

// Mock SharedArrayBuffer if not available
if (typeof SharedArrayBuffer === 'undefined') {
  (global as any).SharedArrayBuffer = ArrayBuffer;
  (global as any).Atomics = {
    store: (arr: any, index: number, value: number) => { arr[index] = value; return value; },
    load: (arr: any, index: number) => arr[index] || 0,
    add: (arr: any, index: number, value: number) => { arr[index] = (arr[index] || 0) + value; return arr[index]; },
    sub: (arr: any, index: number, value: number) => { arr[index] = (arr[index] || 0) - value; return arr[index]; },
    compareExchange: (arr: any, index: number, expected: number, replacement: number) => {
      const old = arr[index] || 0;
      if (old === expected) arr[index] = replacement;
      return old;
    },
    notify: () => 0
  };
}

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager({
      windowSize: 1024,
      windowCount: 10,
      adaptiveResize: true
    });
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('window allocation', () => {
    test('should allocate window with default size', async () => {
      const result = await manager.allocateWindow();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.size).toBe(1024);
    });

    test('should allocate window with custom size', async () => {
      const result = await manager.allocateWindow(2048);
      
      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(2048);
    });

    test('should track allocated windows', async () => {
      const result1 = await manager.allocateWindow();
      const result2 = await manager.allocateWindow();
      
      const metrics = manager.getGlobalMetrics();
      expect(metrics.allocation.currentAllocated).toBe(2);
      expect(metrics.allocation.totalAllocations).toBe(2);
    });

    test('should track peak allocation', async () => {
      // Allocate 3 windows
      const windows = await Promise.all([
        manager.allocateWindow(),
        manager.allocateWindow(),
        manager.allocateWindow()
      ]);
      
      // Release one
      await manager.releaseWindow(windows[0].data!.id);
      
      const metrics = manager.getGlobalMetrics();
      expect(metrics.allocation.currentAllocated).toBe(2);
      expect(metrics.allocation.peakAllocated).toBe(3);
    });
  });

  describe('window retrieval', () => {
    test('should retrieve allocated window by ID', async () => {
      const allocResult = await manager.allocateWindow();
      const windowId = allocResult.data!.id;
      
      const getResult = await manager.getWindow(windowId);
      expect(getResult.success).toBe(true);
      expect(getResult.data?.id).toBe(windowId);
    });

    test('should return error for non-existent window', async () => {
      const result = await manager.getWindow(BigInt(999999));
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should track window access', async () => {
      const allocResult = await manager.allocateWindow();
      const windowId = allocResult.data!.id;
      
      // Access window multiple times
      await manager.getWindow(windowId);
      await manager.getWindow(windowId);
      await manager.getWindow(windowId);
      
      // Window should have recorded accesses
      const internalEntry = (manager as any).windows.get(windowId);
      expect(internalEntry.accessCount).toBe(3);
    });
  });

  describe('memory pools', () => {
    test('should create memory pool', () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'test-pool',
        poolSize: 5,
        bufferSize: 512,
        growthStrategy: 'linear',
        shrinkStrategy: 'never',
        zeroOnReturn: true
      };
      
      expect(() => manager.createPool(poolConfig)).not.toThrow();
    });

    test('should reject duplicate pool names', () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'duplicate',
        poolSize: 5,
        bufferSize: 512,
        growthStrategy: 'fixed',
        shrinkStrategy: 'never',
        zeroOnReturn: false
      };
      
      manager.createPool(poolConfig);
      expect(() => manager.createPool(poolConfig)).toThrow('already exists');
    });

    test('should allocate from pool', async () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'small-pool',
        poolSize: 3,
        bufferSize: 256,
        growthStrategy: 'fixed',
        shrinkStrategy: 'never',
        zeroOnReturn: true
      };
      
      manager.createPool(poolConfig);
      
      const result = await manager.allocateWindow(256, 'small-pool');
      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(256);
    });

    test('should track pool metrics', async () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'metric-pool',
        poolSize: 5,
        bufferSize: 512,
        growthStrategy: 'linear',
        shrinkStrategy: 'idle_based',
        zeroOnReturn: true
      };
      
      manager.createPool(poolConfig);
      
      // Allocate from pool
      await manager.allocateWindow(512, 'metric-pool');
      await manager.allocateWindow(512, 'metric-pool');
      
      const metrics = manager.getGlobalMetrics();
      const poolMetrics = metrics.pools.get('metric-pool');
      
      expect(poolMetrics?.utilized).toBe(2);
      expect(poolMetrics?.available).toBe(3);
    });

    test('should handle pool growth', async () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'growth-pool',
        poolSize: 2,
        bufferSize: 512,
        growthStrategy: 'exponential',
        shrinkStrategy: 'never',
        zeroOnReturn: true
      };
      
      manager.createPool(poolConfig);
      
      // Allocate more than pool size
      const results = await Promise.all([
        manager.allocateWindow(512, 'growth-pool'),
        manager.allocateWindow(512, 'growth-pool'),
        manager.allocateWindow(512, 'growth-pool') // Should trigger growth
      ]);
      
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('window release', () => {
    test('should release window successfully', async () => {
      const allocResult = await manager.allocateWindow();
      const windowId = allocResult.data!.id;
      
      const releaseResult = await manager.releaseWindow(windowId);
      expect(releaseResult.success).toBe(true);
      
      // Window should no longer be retrievable
      const getResult = await manager.getWindow(windowId);
      expect(getResult.success).toBe(false);
    });

    test('should return window to pool', async () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'return-pool',
        poolSize: 3,
        bufferSize: 512,
        growthStrategy: 'fixed',
        shrinkStrategy: 'never',
        zeroOnReturn: true
      };
      
      manager.createPool(poolConfig);
      
      const allocResult = await manager.allocateWindow(512, 'return-pool');
      const windowId = allocResult.data!.id;
      
      // Check initial pool state
      let metrics = manager.getGlobalMetrics();
      expect(metrics.pools.get('return-pool')?.utilized).toBe(1);
      
      // Release window
      await manager.releaseWindow(windowId);
      
      // Window should be back in pool
      metrics = manager.getGlobalMetrics();
      expect(metrics.pools.get('return-pool')?.utilized).toBe(0);
      expect(metrics.pools.get('return-pool')?.available).toBe(3);
    });

    test('should update deallocation metrics', async () => {
      const allocResult = await manager.allocateWindow();
      await manager.releaseWindow(allocResult.data!.id);
      
      const metrics = manager.getGlobalMetrics();
      expect(metrics.allocation.totalDeallocations).toBe(1);
      expect(metrics.allocation.currentAllocated).toBe(0);
    });
  });

  describe('fragmentation tracking', () => {
    test('should calculate fragmentation level', async () => {
      // Allocate windows
      const windows = await Promise.all([
        manager.allocateWindow(),
        manager.allocateWindow(),
        manager.allocateWindow()
      ]);
      
      // Access only first window
      await manager.getWindow(windows[0].data!.id);
      
      const metrics = manager.getGlobalMetrics();
      // 2 out of 3 windows are inactive
      expect(metrics.fragmentation.level).toBeCloseTo(2/3, 2);
    });
  });

  describe('cleanup', () => {
    test('should not cleanup active windows', async () => {
      const allocResult = await manager.allocateWindow();
      const windowId = allocResult.data!.id;
      
      // Keep accessing window
      await manager.getWindow(windowId);
      
      // Trigger cleanup manually
      (manager as any).cleanup();
      
      // Window should still exist
      const getResult = await manager.getWindow(windowId);
      expect(getResult.success).toBe(true);
    });
  });

  describe('concurrent operations', () => {
    test('should handle concurrent allocations', async () => {
      const allocations = Array(10).fill(null).map(() => 
        manager.allocateWindow()
      );
      
      const results = await Promise.all(allocations);
      
      expect(results.every(r => r.success)).toBe(true);
      const ids = results.map(r => r.data!.id);
      expect(new Set(ids).size).toBe(10); // All IDs unique
    });

    test('should handle concurrent pool allocations', async () => {
      const poolConfig: MemoryPoolConfig = {
        name: 'concurrent-pool',
        poolSize: 5,
        bufferSize: 512,
        growthStrategy: 'exponential',
        shrinkStrategy: 'never',
        zeroOnReturn: true
      };
      
      manager.createPool(poolConfig);
      
      const allocations = Array(10).fill(null).map(() => 
        manager.allocateWindow(512, 'concurrent-pool')
      );
      
      const results = await Promise.all(allocations);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle allocation errors gracefully', async () => {
      // Create a manager with an invalid config that will cause allocation to fail
      const invalidManager = new MemoryManager({
        windowSize: -1, // Invalid size
        windowCount: 10
      });
      
      // This should fail due to invalid buffer size
      const result = await invalidManager.allocateWindow();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      await invalidManager.destroy();
    });
  });

  describe('performance', () => {
    test('should allocate windows quickly', async () => {
      const startTime = performance.now();
      
      await Promise.all(
        Array(100).fill(null).map(() => manager.allocateWindow(1024))
      );
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    test('should handle large windows', async () => {
      const largeManager = new MemoryManager({
        windowSize: 1048576, // 1MB
        maxWindowSize: 10485760 // 10MB
      });
      
      const result = await largeManager.allocateWindow(5242880); // 5MB
      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(5242880);
      
      await largeManager.destroy();
    });
  });
});