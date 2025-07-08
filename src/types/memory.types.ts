/**
 * Memory management type definitions for SILC Protocol
 */

/**
 * Shared memory window configuration
 */
export interface MemoryWindowConfig {
  /** Base window size in bytes (default: 4096) */
  windowSize: number;

  /** Number of concurrent windows */
  windowCount: number;

  /** Allow dynamic window resizing */
  adaptiveResize: boolean;

  /** Resize increment in bytes (default: 4096) */
  resizeIncrement: number;

  /** Maximum window size in bytes (default: 1MB) */
  maxWindowSize: number;
}

/**
 * Shared memory layout structure
 */
export interface SharedMemoryLayout {
  /** Header section (64 bytes) */
  header: MemoryHeader;

  /** Signal data buffer */
  dataBuffer: ArrayBuffer;

  /** Metadata buffer (64 bytes) */
  metadataBuffer: ArrayBuffer;
}

/**
 * Memory window header structure
 */
export interface MemoryHeader {
  /** Magic number (4 bytes): 0x53494C43 ('SILC') */
  magicNumber: number;

  /** Protocol version (4 bytes) */
  version: number;

  /** Window ID (8 bytes) */
  windowId: bigint;

  /** Actual data length (4 bytes) */
  dataLength: number;

  /** Data integrity checksum (4 bytes) */
  checksum: number;

  /** Last modification timestamp (8 bytes) */
  timestamp: bigint;

  /** Current writer identifier (8 bytes) */
  writerId: bigint;

  /** Active reader count (4 bytes) */
  readerCount: number;

  /** Status and control flags (4 bytes) */
  flags: number;

  /** Reserved for future use (16 bytes) */
  reserved: ArrayBuffer;
}

/**
 * Memory synchronization configuration
 */
export interface MemorySynchronization {
  /** Lock-free synchronization settings */
  lockFree: {
    atomicOperations: 'compare_and_swap';
    memoryOrdering: 'acquire_release';
    hazardPointers: boolean;
    epochBasedReclamation: boolean;
  };

  /** Producer-consumer coordination */
  coordination: {
    ringBuffer: boolean;
    multipleProducers: boolean;
    multipleConsumers: boolean;
    backpressure: 'adaptive_rate_limiting';
  };

  /** Conflict resolution strategies */
  conflicts: {
    writerConflict: 'first_writer_wins';
    staleReader: 'automatic_refresh';
    corruptedData: 'checksum_verification';
    timeoutHandling: 'graceful_abort';
  };
}

/**
 * Memory allocation configuration
 */
export interface MemoryAllocationConfig {
  /** Buffer type */
  bufferType: 'SharedArrayBuffer';

  /** Memory alignment (cache line) */
  alignment: number;

  /** Enable guard pages for protection */
  guardPages: boolean;

  /** Initialize memory to zero */
  zeroInitialization: boolean;
}

/**
 * Memory access control
 */
export interface MemoryAccessControl {
  /** Multiple concurrent readers allowed */
  concurrentReaders: 'unlimited';

  /** Single writer at a time */
  exclusiveWriter: boolean;

  /** Locking mechanism */
  lockingMechanism: 'atomic_operations';

  /** Timeout in milliseconds */
  timeoutHandling: number;
}

/**
 * Memory window status flags
 */
export enum MemoryWindowFlags {
  /** Window is locked for writing */
  WRITE_LOCKED = 0x01,

  /** Window has been modified */
  DIRTY = 0x02,

  /** Window is ready for reading */
  READY = 0x04,

  /** Window is being resized */
  RESIZING = 0x08,

  /** Window data is corrupted */
  CORRUPTED = 0x10,

  /** Window is marked for deletion */
  PENDING_DELETE = 0x20,
}

/**
 * Memory pool configuration
 */
export interface MemoryPoolConfig {
  /** Pool name */
  name: string;

  /** Number of pre-allocated buffers */
  poolSize: number;

  /** Size of each buffer */
  bufferSize: number;

  /** Pool growth strategy */
  growthStrategy: 'exponential' | 'linear' | 'fixed';

  /** Pool shrinking strategy */
  shrinkStrategy: 'idle_based' | 'never' | 'aggressive';

  /** Zero memory on return */
  zeroOnReturn: boolean;
}

/**
 * Memory performance metrics
 */
export interface MemoryMetrics {
  /** Allocation statistics */
  allocation: {
    totalAllocations: number;
    totalDeallocations: number;
    currentAllocated: number;
    peakAllocated: number;
    allocationRate: number;
    deallocationRate: number;
  };

  /** Pool utilization */
  pools: Map<
    string,
    {
      utilized: number;
      available: number;
      hitRate: number;
      missRate: number;
    }
  >;

  /** Fragmentation metrics */
  fragmentation: {
    level: number;
    largestFreeBlock: number;
    totalFreeSpace: number;
  };

  /** Performance metrics */
  performance: {
    averageAllocationTime: number;
    averageDeallocationTime: number;
    cacheMisses: number;
    pageFlushes: number;
  };
}

/**
 * Memory operation result
 */
export interface MemoryOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  metrics?: {
    duration: number;
    retries: number;
    bytesProcessed: number;
  };
}

/**
 * Shared memory window interface
 */
export interface ISharedMemoryWindow {
  /** Window identifier */
  readonly id: bigint;

  /** Window size in bytes */
  readonly size: number;

  /** Window status flags */
  readonly flags: number;

  /** Acquire write lock */
  acquireWriteLock(timeout?: number): Promise<boolean>;

  /** Release write lock */
  releaseWriteLock(): void;

  /** Write data to window */
  write(data: Uint8Array, offset?: number): Promise<MemoryOperationResult>;

  /** Read data from window */
  read(length?: number, offset?: number): Promise<MemoryOperationResult<Uint8Array>>;

  /** Resize window */
  resize(newSize: number): Promise<MemoryOperationResult>;

  /** Get window metrics */
  getMetrics(): MemoryMetrics;

  /** Destroy window */
  destroy(): Promise<void>;
}
