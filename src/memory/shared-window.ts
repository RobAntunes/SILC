/**
 * SharedArrayBuffer-based memory window implementation
 *
 * Provides zero-latency local communication between AI agents
 * using shared memory with atomic operations for synchronization.
 */

import type {
  ISharedMemoryWindow,
  MemoryHeader,
  MemoryMetrics,
  MemoryOperationResult,
  MemoryWindowConfig,
} from '../types/memory.types';
import { MemoryWindowFlags } from '../types/memory.types';

/**
 * Constants for memory layout
 */
const HEADER_SIZE = 64; // bytes
const METADATA_SIZE = 64; // bytes
const MAGIC_NUMBER = 0x53494c43; // 'SILC' in hex
const CACHE_LINE_SIZE = 64; // bytes
const DEFAULT_WINDOW_SIZE = 4096; // 4KB

/**
 * Header field offsets (in bytes)
 */
const HEADER_OFFSETS = {
  MAGIC_NUMBER: 0, // 4 bytes
  VERSION: 4, // 4 bytes
  WINDOW_ID_LOW: 8, // 4 bytes (low 32 bits)
  WINDOW_ID_HIGH: 12, // 4 bytes (high 32 bits)
  DATA_LENGTH: 16, // 4 bytes
  CHECKSUM: 20, // 4 bytes
  TIMESTAMP_LOW: 24, // 4 bytes (low 32 bits)
  TIMESTAMP_HIGH: 28, // 4 bytes (high 32 bits)
  WRITER_ID_LOW: 32, // 4 bytes (low 32 bits)
  WRITER_ID_HIGH: 36, // 4 bytes (high 32 bits)
  READER_COUNT: 40, // 4 bytes
  FLAGS: 44, // 4 bytes
  RESERVED: 48, // 16 bytes
} as const;

/**
 * SharedMemoryWindow implementation
 */
export class SharedMemoryWindow implements ISharedMemoryWindow {
  private buffer: SharedArrayBuffer;
  private headerView: Int32Array;
  private dataView: Uint8Array;
  private metadataView: Uint8Array;
  private readonly windowId: bigint;
  private readonly config: MemoryWindowConfig;
  private metrics: MemoryMetrics;
  private destroyed: boolean = false;

  constructor(config: MemoryWindowConfig, windowId?: bigint) {
    this.config = config;
    this.windowId =
      windowId ?? (BigInt(Date.now()) << 16n) | BigInt(Math.floor(Math.random() * 0xffff));
    this.metrics = this.initializeMetrics();

    // Validate window size
    if (config.windowSize <= 0) {
      throw new Error('Window size must be positive');
    }

    // Allocate shared memory buffer
    const totalSize = HEADER_SIZE + config.windowSize + METADATA_SIZE;
    this.buffer = new SharedArrayBuffer(totalSize);

    // Create views for different sections
    this.headerView = new Int32Array(this.buffer, 0, HEADER_SIZE / 4);
    this.dataView = new Uint8Array(this.buffer, HEADER_SIZE, config.windowSize);
    this.metadataView = new Uint8Array(this.buffer, HEADER_SIZE + config.windowSize, METADATA_SIZE);

    // Initialize header
    this.initializeHeader();
  }

  /**
   * Get window identifier
   */
  get id(): bigint {
    return this.windowId;
  }

  /**
   * Get current window size
   */
  get size(): number {
    return this.config.windowSize;
  }

  /**
   * Get window status flags
   */
  get flags(): number {
    return Atomics.load(this.headerView, HEADER_OFFSETS.FLAGS / 4);
  }

  /**
   * Initialize window header
   */
  private initializeHeader(): void {
    // Set magic number
    Atomics.store(this.headerView, HEADER_OFFSETS.MAGIC_NUMBER / 4, MAGIC_NUMBER);

    // Set version (1.0.0 encoded as 0x00010000)
    Atomics.store(this.headerView, HEADER_OFFSETS.VERSION / 4, 0x00010000);

    // Set window ID
    const windowIdLow = Number(this.windowId & 0xffffffffn);
    const windowIdHigh = Number((this.windowId >> 32n) & 0xffffffffn);
    Atomics.store(this.headerView, HEADER_OFFSETS.WINDOW_ID_LOW / 4, windowIdLow);
    Atomics.store(this.headerView, HEADER_OFFSETS.WINDOW_ID_HIGH / 4, windowIdHigh);

    // Initialize other fields
    Atomics.store(this.headerView, HEADER_OFFSETS.DATA_LENGTH / 4, 0);
    Atomics.store(this.headerView, HEADER_OFFSETS.CHECKSUM / 4, 0);
    Atomics.store(this.headerView, HEADER_OFFSETS.READER_COUNT / 4, 0);
    Atomics.store(this.headerView, HEADER_OFFSETS.FLAGS / 4, MemoryWindowFlags.READY);

    // Zero initialize if configured
    if (this.config.zeroInitialization ?? true) {
      this.dataView.fill(0);
      this.metadataView.fill(0);
    }
  }

  /**
   * Acquire write lock with timeout
   */
  async acquireWriteLock(timeout: number = 1000): Promise<boolean> {
    if (this.destroyed) {
      throw new Error('Window has been destroyed');
    }

    const startTime = performance.now();
    const flagsIndex = HEADER_OFFSETS.FLAGS / 4;

    while (performance.now() - startTime < timeout) {
      const currentFlags = Atomics.load(this.headerView, flagsIndex);

      // Check if already locked
      if (currentFlags & MemoryWindowFlags.WRITE_LOCKED) {
        // Wait and retry
        await this.sleep(1);
        continue;
      }

      // Try to acquire lock atomically
      const newFlags = currentFlags | MemoryWindowFlags.WRITE_LOCKED;
      const result = Atomics.compareExchange(this.headerView, flagsIndex, currentFlags, newFlags);

      if (result === currentFlags) {
        // Successfully acquired lock
        // Update writer ID
        const writerId =
          (BigInt(process.pid || 0) << 32n) | BigInt(Math.floor(Date.now()) & 0xffffffff);
        const writerIdLow = Number(writerId & 0xffffffffn);
        const writerIdHigh = Number((writerId >> 32n) & 0xffffffffn);
        Atomics.store(this.headerView, HEADER_OFFSETS.WRITER_ID_LOW / 4, writerIdLow);
        Atomics.store(this.headerView, HEADER_OFFSETS.WRITER_ID_HIGH / 4, writerIdHigh);

        return true;
      }
    }

    return false; // Timeout
  }

  /**
   * Release write lock
   */
  releaseWriteLock(): void {
    if (this.destroyed) {
      throw new Error('Window has been destroyed');
    }

    const flagsIndex = HEADER_OFFSETS.FLAGS / 4;
    const currentFlags = Atomics.load(this.headerView, flagsIndex);
    const newFlags = currentFlags & ~MemoryWindowFlags.WRITE_LOCKED;
    Atomics.store(this.headerView, flagsIndex, newFlags);

    // Notify waiting threads
    Atomics.notify(this.headerView, flagsIndex);
  }

  /**
   * Write data to window
   */
  async write(data: Uint8Array, offset: number = 0): Promise<MemoryOperationResult> {
    if (this.destroyed) {
      return { success: false, error: 'Window has been destroyed' };
    }

    const startTime = performance.now();

    // Validate parameters
    if (offset < 0 || offset + data.length > this.config.windowSize) {
      return {
        success: false,
        error: 'Write would exceed window bounds',
      };
    }

    // Acquire write lock
    const lockAcquired = await this.acquireWriteLock();
    if (!lockAcquired) {
      return {
        success: false,
        error: 'Failed to acquire write lock',
      };
    }

    try {
      // Copy data
      this.dataView.set(data, offset);

      // Update data length
      const dataLength = Math.max(
        Atomics.load(this.headerView, HEADER_OFFSETS.DATA_LENGTH / 4),
        offset + data.length,
      );
      Atomics.store(this.headerView, HEADER_OFFSETS.DATA_LENGTH / 4, dataLength);

      // Update checksum
      const checksum = this.calculateChecksum(this.dataView.subarray(0, dataLength));
      Atomics.store(this.headerView, HEADER_OFFSETS.CHECKSUM / 4, checksum);

      // Update timestamp
      const timestamp = BigInt(Date.now());
      const timestampLow = Number(timestamp & 0xffffffffn);
      const timestampHigh = Number((timestamp >> 32n) & 0xffffffffn);
      Atomics.store(this.headerView, HEADER_OFFSETS.TIMESTAMP_LOW / 4, timestampLow);
      Atomics.store(this.headerView, HEADER_OFFSETS.TIMESTAMP_HIGH / 4, timestampHigh);

      // Set dirty flag
      const flagsIndex = HEADER_OFFSETS.FLAGS / 4;
      const flags = Atomics.load(this.headerView, flagsIndex);
      Atomics.store(this.headerView, flagsIndex, flags | MemoryWindowFlags.DIRTY);

      // Update metrics
      this.metrics.allocation.totalAllocations++;
      this.metrics.performance.averageAllocationTime =
        (this.metrics.performance.averageAllocationTime + (performance.now() - startTime)) / 2;

      return {
        success: true,
        metrics: {
          duration: performance.now() - startTime,
          retries: 0,
          bytesProcessed: data.length,
        },
      };
    } finally {
      this.releaseWriteLock();
    }
  }

  /**
   * Read data from window
   */
  async read(length?: number, offset: number = 0): Promise<MemoryOperationResult<Uint8Array>> {
    if (this.destroyed) {
      return { success: false, error: 'Window has been destroyed' };
    }

    const startTime = performance.now();

    // Increment reader count
    Atomics.add(this.headerView, HEADER_OFFSETS.READER_COUNT / 4, 1);

    try {
      // Get data length
      const dataLength = Atomics.load(this.headerView, HEADER_OFFSETS.DATA_LENGTH / 4);
      const readLength = length ?? dataLength - offset;

      // Validate parameters
      if (offset < 0 || offset + readLength > dataLength) {
        return {
          success: false,
          error: 'Read would exceed data bounds',
        };
      }

      // Read data
      const data = new Uint8Array(readLength);
      data.set(this.dataView.subarray(offset, offset + readLength));

      // Verify checksum
      const expectedChecksum = Atomics.load(this.headerView, HEADER_OFFSETS.CHECKSUM / 4);
      const actualChecksum = this.calculateChecksum(this.dataView.subarray(0, dataLength));

      if (expectedChecksum !== actualChecksum) {
        return {
          success: false,
          error: 'Data corruption detected',
        };
      }

      return {
        success: true,
        data,
        metrics: {
          duration: performance.now() - startTime,
          retries: 0,
          bytesProcessed: readLength,
        },
      };
    } finally {
      // Decrement reader count
      Atomics.sub(this.headerView, HEADER_OFFSETS.READER_COUNT / 4, 1);
    }
  }

  /**
   * Resize window
   */
  async resize(newSize: number): Promise<MemoryOperationResult> {
    if (this.destroyed) {
      return { success: false, error: 'Window has been destroyed' };
    }

    if (!this.config.adaptiveResize) {
      return { success: false, error: 'Adaptive resize not enabled' };
    }

    if (newSize > this.config.maxWindowSize) {
      return { success: false, error: 'New size exceeds maximum window size' };
    }

    // Acquire write lock
    const lockAcquired = await this.acquireWriteLock();
    if (!lockAcquired) {
      return { success: false, error: 'Failed to acquire write lock for resize' };
    }

    try {
      // Set resizing flag
      const flagsIndex = HEADER_OFFSETS.FLAGS / 4;
      const flags = Atomics.load(this.headerView, flagsIndex);
      Atomics.store(this.headerView, flagsIndex, flags | MemoryWindowFlags.RESIZING);

      // Wait for readers to finish
      while (Atomics.load(this.headerView, HEADER_OFFSETS.READER_COUNT / 4) > 0) {
        await this.sleep(1);
      }

      // Create new buffer
      const totalSize = HEADER_SIZE + newSize + METADATA_SIZE;
      const newBuffer = new SharedArrayBuffer(totalSize);

      // Copy existing data
      const dataLength = Atomics.load(this.headerView, HEADER_OFFSETS.DATA_LENGTH / 4);
      const copyLength = Math.min(dataLength, newSize);

      new Uint8Array(newBuffer).set(
        new Uint8Array(this.buffer, 0, HEADER_SIZE + copyLength + METADATA_SIZE),
      );

      // Update internal references
      this.buffer = newBuffer;
      this.headerView = new Int32Array(this.buffer, 0, HEADER_SIZE / 4);
      this.dataView = new Uint8Array(this.buffer, HEADER_SIZE, newSize);
      this.metadataView = new Uint8Array(this.buffer, HEADER_SIZE + newSize, METADATA_SIZE);

      // Update config
      this.config.windowSize = newSize;

      // Clear resizing flag
      const newFlags = Atomics.load(this.headerView, flagsIndex) & ~MemoryWindowFlags.RESIZING;
      Atomics.store(this.headerView, flagsIndex, newFlags);

      return { success: true };
    } finally {
      this.releaseWriteLock();
    }
  }

  /**
   * Get window metrics
   */
  getMetrics(): MemoryMetrics {
    return { ...this.metrics };
  }

  /**
   * Destroy window
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    // Set pending delete flag
    const flagsIndex = HEADER_OFFSETS.FLAGS / 4;
    const flags = Atomics.load(this.headerView, flagsIndex);
    Atomics.store(this.headerView, flagsIndex, flags | MemoryWindowFlags.PENDING_DELETE);

    // Wait for all operations to complete
    while (
      Atomics.load(this.headerView, flagsIndex) & MemoryWindowFlags.WRITE_LOCKED ||
      Atomics.load(this.headerView, HEADER_OFFSETS.READER_COUNT / 4) > 0
    ) {
      await this.sleep(10);
    }

    // Clear all data
    if (this.config.zeroInitialization ?? true) {
      new Uint8Array(this.buffer).fill(0);
    }

    this.destroyed = true;
  }

  /**
   * Calculate CRC32 checksum
   */
  private calculateChecksum(data: Uint8Array): number {
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }

    return ~crc >>> 0;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
}
