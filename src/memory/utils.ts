/**
 * Memory management utility functions
 */

import type { MemoryWindowConfig, MemoryPoolConfig } from '../types/memory.types';
import { MemoryManager } from './manager';

/**
 * Create a memory manager with default configuration
 */
export function createMemoryManager(config?: Partial<MemoryWindowConfig>): MemoryManager {
  const manager = new MemoryManager(config);
  
  // Create default pools
  manager.createPool({
    name: 'small',
    poolSize: 100,
    bufferSize: 1024,     // 1KB buffers
    growthStrategy: 'exponential',
    shrinkStrategy: 'idle_based',
    zeroOnReturn: true
  });

  manager.createPool({
    name: 'medium',
    poolSize: 50,
    bufferSize: 4096,     // 4KB buffers
    growthStrategy: 'linear',
    shrinkStrategy: 'idle_based',
    zeroOnReturn: true
  });

  manager.createPool({
    name: 'large',
    poolSize: 10,
    bufferSize: 65536,    // 64KB buffers
    growthStrategy: 'linear',
    shrinkStrategy: 'aggressive',
    zeroOnReturn: true
  });

  return manager;
}

/**
 * Create a memory pool configuration
 */
export function createMemoryPool(
  name: string,
  size: number,
  count: number,
  options?: Partial<MemoryPoolConfig>
): MemoryPoolConfig {
  return {
    name,
    poolSize: count,
    bufferSize: size,
    growthStrategy: 'exponential',
    shrinkStrategy: 'idle_based',
    zeroOnReturn: true,
    ...options
  };
}

/**
 * Calculate optimal window size based on signal characteristics
 */
export function calculateOptimalWindowSize(
  signalCount: number,
  averageSignalSize: number,
  includeMetadata: boolean = true
): number {
  const HEADER_SIZE = 64;
  const METADATA_SIZE = includeMetadata ? 64 : 0;
  const CACHE_LINE_SIZE = 64;
  
  // Calculate raw size needed
  const rawSize = signalCount * averageSignalSize;
  
  // Add protocol overhead
  const totalSize = HEADER_SIZE + rawSize + METADATA_SIZE;
  
  // Align to cache line boundaries
  const alignedSize = Math.ceil(totalSize / CACHE_LINE_SIZE) * CACHE_LINE_SIZE;
  
  // Round up to power of 2 for optimal memory allocation
  return Math.pow(2, Math.ceil(Math.log2(alignedSize)));
}

/**
 * Memory size formatter
 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Check if SharedArrayBuffer is available
 */
export function isSharedMemoryAvailable(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && 
         typeof Atomics !== 'undefined';
}

/**
 * Enable cross-origin isolation headers (for browsers)
 */
export function getCrossOriginIsolationHeaders(): Record<string, string> {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  };
}