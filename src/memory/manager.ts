/**
 * Memory Manager for SILC Protocol
 *
 * Manages shared memory windows, pools, and provides
 * cache-optimized memory allocation strategies.
 */

import type {
  ISharedMemoryWindow,
  MemoryMetrics,
  MemoryOperationResult,
  MemoryPoolConfig,
  MemoryWindowConfig,
} from '../types/memory.types';
import { SharedMemoryWindow } from './shared-window';

/**
 * Window registry entry
 */
interface WindowEntry {
  window: SharedMemoryWindow;
  lastAccessed: number;
  accessCount: number;
  poolName?: string;
}

/**
 * Memory pool implementation
 */
class MemoryPool {
  private readonly config: MemoryPoolConfig;
  private readonly freeWindows: SharedMemoryWindow[] = [];
  private readonly usedWindows: Set<bigint> = new Set();
  private metrics = {
    hits: 0,
    misses: 0,
    allocations: 0,
    deallocations: 0,
  };

  constructor(config: MemoryPoolConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize pool with pre-allocated windows
   */
  private initialize(): void {
    const windowConfig: MemoryWindowConfig = {
      windowSize: this.config.bufferSize,
      windowCount: this.config.poolSize,
      adaptiveResize: false,
      resizeIncrement: 0,
      maxWindowSize: this.config.bufferSize,
    };

    for (let i = 0; i < this.config.poolSize; i++) {
      this.freeWindows.push(new SharedMemoryWindow(windowConfig));
    }
  }

  /**
   * Acquire window from pool
   */
  acquire(): SharedMemoryWindow | null {
    if (this.freeWindows.length === 0) {
      this.metrics.misses++;

      // Handle growth strategy
      if (this.config.growthStrategy !== 'fixed') {
        this.grow();
        return this.freeWindows.pop() ?? null;
      }

      return null;
    }

    const window = this.freeWindows.pop()!;
    this.usedWindows.add(window.id);
    this.metrics.hits++;
    this.metrics.allocations++;

    return window;
  }

  /**
   * Release window back to pool
   */
  release(window: SharedMemoryWindow): boolean {
    if (!this.usedWindows.has(window.id)) {
      return false;
    }

    this.usedWindows.delete(window.id);

    // Zero memory if configured
    if (this.config.zeroOnReturn) {
      // Window will handle zeroing in its write method
    }

    // Check shrink strategy
    if (this.shouldShrink()) {
      window.destroy();
      this.metrics.deallocations++;
      return true;
    }

    this.freeWindows.push(window);
    this.metrics.deallocations++;
    return true;
  }

  /**
   * Grow pool based on strategy
   */
  private grow(): void {
    let growthSize = 0;

    switch (this.config.growthStrategy) {
      case 'exponential':
        growthSize = Math.ceil(this.config.poolSize * 0.5);
        break;
      case 'linear':
        growthSize = 10;
        break;
    }

    const windowConfig: MemoryWindowConfig = {
      windowSize: this.config.bufferSize,
      windowCount: growthSize,
      adaptiveResize: false,
      resizeIncrement: 0,
      maxWindowSize: this.config.bufferSize,
    };

    for (let i = 0; i < growthSize; i++) {
      this.freeWindows.push(new SharedMemoryWindow(windowConfig));
    }
  }

  /**
   * Check if pool should shrink
   */
  private shouldShrink(): boolean {
    if (this.config.shrinkStrategy === 'never') {
      return false;
    }

    const utilization = this.usedWindows.size / (this.freeWindows.length + this.usedWindows.size);

    switch (this.config.shrinkStrategy) {
      case 'idle_based':
        return utilization < 0.25 && this.freeWindows.length > this.config.poolSize;
      case 'aggressive':
        return utilization < 0.5 && this.freeWindows.length > this.config.poolSize / 2;
      default:
        return false;
    }
  }

  /**
   * Get pool metrics
   */
  getMetrics() {
    return {
      utilized: this.usedWindows.size,
      available: this.freeWindows.length,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses),
      missRate: this.metrics.misses / (this.metrics.hits + this.metrics.misses),
    };
  }

  /**
   * Destroy pool and all windows
   */
  async destroy(): Promise<void> {
    // Destroy all windows
    const allWindows = [...this.freeWindows];

    await Promise.all(allWindows.map((w) => w.destroy()));

    this.freeWindows.length = 0;
    this.usedWindows.clear();
  }
}

/**
 * Memory Manager implementation
 */
export class MemoryManager {
  private windows: Map<bigint, WindowEntry> = new Map();
  private pools: Map<string, MemoryPool> = new Map();
  private defaultConfig: MemoryWindowConfig;
  private globalMetrics: MemoryMetrics;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(defaultConfig?: Partial<MemoryWindowConfig>) {
    this.defaultConfig = {
      windowSize: 4096,
      windowCount: 100,
      adaptiveResize: true,
      resizeIncrement: 4096,
      maxWindowSize: 1048576, // 1MB
      ...defaultConfig,
    };

    this.globalMetrics = this.initializeMetrics();

    // Start cleanup task
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Create a new memory pool
   */
  createPool(config: MemoryPoolConfig): void {
    if (this.pools.has(config.name)) {
      throw new Error(`Pool ${config.name} already exists`);
    }

    this.pools.set(config.name, new MemoryPool(config));
  }

  /**
   * Allocate a new shared memory window
   */
  async allocateWindow(
    size?: number,
    poolName?: string,
  ): Promise<MemoryOperationResult<ISharedMemoryWindow>> {
    const startTime = performance.now();

    try {
      let window: SharedMemoryWindow | null = null;

      // Try to get from pool first
      if (poolName && this.pools.has(poolName)) {
        window = this.pools.get(poolName)!.acquire();
      }

      // Create new window if not from pool
      if (!window) {
        const config = {
          ...this.defaultConfig,
          windowSize: size ?? this.defaultConfig.windowSize,
        };
        window = new SharedMemoryWindow(config);
      }

      // Register window
      this.windows.set(window.id, {
        window,
        lastAccessed: Date.now(),
        accessCount: 0,
        poolName,
      });

      // Update metrics
      this.globalMetrics.allocation.totalAllocations++;
      this.globalMetrics.allocation.currentAllocated++;
      this.globalMetrics.allocation.peakAllocated = Math.max(
        this.globalMetrics.allocation.peakAllocated,
        this.globalMetrics.allocation.currentAllocated,
      );

      return {
        success: true,
        data: window,
        metrics: {
          duration: performance.now() - startTime,
          retries: 0,
          bytesProcessed: window.size,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get existing window by ID
   */
  async getWindow(windowId: bigint): Promise<MemoryOperationResult<ISharedMemoryWindow>> {
    const entry = this.windows.get(windowId);

    if (!entry) {
      return {
        success: false,
        error: 'Window not found',
      };
    }

    // Update access tracking
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    return {
      success: true,
      data: entry.window,
    };
  }

  /**
   * Release a window
   */
  async releaseWindow(windowId: bigint): Promise<MemoryOperationResult> {
    const entry = this.windows.get(windowId);

    if (!entry) {
      return {
        success: false,
        error: 'Window not found',
      };
    }

    // Return to pool if applicable
    if (entry.poolName && this.pools.has(entry.poolName)) {
      const pool = this.pools.get(entry.poolName)!;
      pool.release(entry.window);
    } else {
      // Destroy window
      await entry.window.destroy();
    }

    // Remove from registry
    this.windows.delete(windowId);

    // Update metrics
    this.globalMetrics.allocation.totalDeallocations++;
    this.globalMetrics.allocation.currentAllocated--;

    return { success: true };
  }

  /**
   * Get memory manager metrics
   */
  getGlobalMetrics(): MemoryMetrics {
    // Update pool metrics
    this.globalMetrics.pools.clear();
    for (const [name, pool] of this.pools) {
      this.globalMetrics.pools.set(name, pool.getMetrics());
    }

    // Calculate fragmentation
    const totalWindows = this.windows.size;
    const activeWindows = Array.from(this.windows.values()).filter((e) => e.accessCount > 0).length;

    this.globalMetrics.fragmentation.level =
      totalWindows > 0 ? (totalWindows - activeWindows) / totalWindows : 0;

    return { ...this.globalMetrics };
  }

  /**
   * Cleanup inactive windows
   */
  private cleanup(): void {
    const now = Date.now();
    const inactiveThreshold = 300000; // 5 minutes

    for (const [windowId, entry] of this.windows) {
      if (now - entry.lastAccessed > inactiveThreshold && entry.accessCount === 0) {
        this.releaseWindow(windowId);
      }
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): MemoryMetrics {
    return {
      allocation: {
        totalAllocations: 0,
        totalDeallocations: 0,
        currentAllocated: 0,
        peakAllocated: 0,
        allocationRate: 0,
        deallocationRate: 0,
      },
      pools: new Map(),
      fragmentation: {
        level: 0,
        largestFreeBlock: 0,
        totalFreeSpace: 0,
      },
      performance: {
        averageAllocationTime: 0,
        averageDeallocationTime: 0,
        cacheMisses: 0,
        pageFlushes: 0,
      },
    };
  }

  /**
   * Destroy memory manager
   */
  async destroy(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Destroy all pools
    await Promise.all(Array.from(this.pools.values()).map((pool) => pool.destroy()));

    // Destroy all windows
    await Promise.all(Array.from(this.windows.values()).map((entry) => entry.window.destroy()));

    this.windows.clear();
    this.pools.clear();
  }
}
