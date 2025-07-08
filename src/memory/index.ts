/**
 * SILC Protocol Memory Management Module
 *
 * Provides zero-latency local communication through SharedArrayBuffer
 * with lock-free synchronization and cache-optimized memory layout.
 */

// Re-export types
export type {
  MemoryWindowConfig,
  SharedMemoryLayout,
  MemoryHeader,
  MemorySynchronization,
  MemoryAllocationConfig,
  MemoryAccessControl,
  MemoryPoolConfig,
  MemoryMetrics,
  MemoryOperationResult,
  ISharedMemoryWindow,
} from '../types/memory.types';

export { MemoryWindowFlags } from '../types/memory.types';

// Export implementations
export { SharedMemoryWindow } from './shared-window';
export { MemoryManager } from './manager';

// Export convenience functions
export { createMemoryManager, createMemoryPool } from './utils';

/**
 * Default memory window configuration
 */
export const DEFAULT_WINDOW_CONFIG: MemoryWindowConfig = {
  windowSize: 4096, // 4KB
  windowCount: 100, // 100 concurrent windows
  adaptiveResize: true, // Allow dynamic resizing
  resizeIncrement: 4096, // 4KB increments
  maxWindowSize: 1048576, // 1MB max
};

/**
 * Performance-optimized configuration
 */
export const PERFORMANCE_CONFIG: MemoryWindowConfig = {
  windowSize: 65536, // 64KB for better throughput
  windowCount: 1000, // More concurrent windows
  adaptiveResize: true,
  resizeIncrement: 65536,
  maxWindowSize: 10485760, // 10MB max
};

/**
 * Memory-constrained configuration
 */
export const CONSTRAINED_CONFIG: MemoryWindowConfig = {
  windowSize: 1024, // 1KB
  windowCount: 10, // Limited windows
  adaptiveResize: false, // No resizing
  resizeIncrement: 0,
  maxWindowSize: 1024,
};
