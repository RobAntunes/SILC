/**
 * Common type definitions used throughout SILC Protocol
 */

/**
 * SILC error categories
 */
export enum SILCErrorCategory {
  // Protocol errors
  PROTOCOL_VERSION_MISMATCH = 'protocol.version_mismatch',
  INVALID_MESSAGE_FORMAT = 'protocol.invalid_format',
  UNSUPPORTED_OPERATION = 'protocol.unsupported_operation',

  // Signal errors
  SIGNAL_CORRUPTION = 'signal.corruption',
  SIGNAL_TRUNCATION = 'signal.truncation',
  INVALID_SIGNAL_PARAMETERS = 'signal.invalid_parameters',

  // Memory errors
  INSUFFICIENT_MEMORY = 'memory.insufficient',
  MEMORY_CORRUPTION = 'memory.corruption',
  MEMORY_ACCESS_VIOLATION = 'memory.access_violation',

  // Transmission errors
  TRANSMISSION_TIMEOUT = 'transmission.timeout',
  SEGMENT_LOSS = 'transmission.segment_loss',
  ASSEMBLY_FAILURE = 'transmission.assembly_failure',

  // Dialect errors
  DIALECT_INCOMPATIBILITY = 'dialect.incompatibility',
  PATTERN_RECOGNITION_FAILURE = 'dialect.pattern_failure',
  TRANSLATION_ERROR = 'dialect.translation_error',

  // System errors
  RESOURCE_EXHAUSTION = 'system.resource_exhaustion',
  HARDWARE_FAILURE = 'system.hardware_failure',
  UNEXPECTED_TERMINATION = 'system.termination',
  SYSTEM_FAILURE = 'system.failure',
  PROTOCOL_VIOLATION = 'protocol.violation',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  CRITICAL = 4, // System cannot continue
  HIGH = 3, // Major functionality affected
  MEDIUM = 2, // Some functionality affected
  LOW = 1, // Minor issues
  INFO = 0, // Informational
}

/**
 * SILC error structure
 */
export interface SILCError extends Error {
  /** Error category */
  category: SILCErrorCategory;

  /** Error severity */
  severity: ErrorSeverity;

  /** Error code for programmatic handling */
  code: number;

  /** Additional error context */
  context?: Record<string, unknown>;

  /** Timestamp when error occurred */
  timestamp: number;

  /** Stack trace */
  stack?: string;
}

/**
 * Performance metrics structure
 */
export interface PerformanceMetrics {
  /** Latency measurements */
  latency: {
    signalEncoding: number;
    signalDecoding: number;
    transmission: number;
    reception: number;
  };

  /** Throughput measurements */
  throughput: {
    signalsPerSecond: number;
    bytesPerSecond: number;
    messagesPerSecond: number;
  };

  /** Memory usage */
  memory: {
    allocated: number;
    peak: number;
    fragmentation: number;
  };

  /** Error rates */
  errors: {
    rate: number;
    total: number;
    byCategory: Record<SILCErrorCategory, number>;
  };

  /** Resource utilization */
  resources: {
    cpu: number;
    memory: number;
    network: number;
  };
}

/**
 * Configuration options for SILC protocol
 */
export interface ConfigurationOptions {
  /** Protocol version to use */
  protocolVersion?: string;

  /** Enable debug logging */
  debug?: boolean;

  /** Log level */
  logLevel?: 'error' | 'warn' | 'info' | 'debug';

  /** Performance monitoring */
  enableMetrics?: boolean;

  /** Automatic error recovery */
  autoRecovery?: boolean;

  /** Resource limits */
  limits?: {
    maxMemory?: number;
    maxSignalSize?: number;
    maxConcurrentOperations?: number;
  };
}

/**
 * Callback function types
 */
export type ErrorHandler = (error: SILCError) => void;
export type MetricsCallback = (metrics: PerformanceMetrics) => void;
export type SignalCallback = (signal: unknown) => void;

/**
 * Promise-based operation result
 */
export interface OperationResult<T> {
  /** Whether operation succeeded */
  success: boolean;

  /** Result data if successful */
  data?: T;

  /** Error information if failed */
  error?: SILCError;

  /** Operation metadata */
  metadata?: {
    duration: number;
    retries: number;
    timestamp: number;
  };
}

/**
 * Async iterator for streaming operations
 */
export interface SILCAsyncIterator<T> extends AsyncIterableIterator<T> {
  /** Cancel the iterator */
  cancel(): Promise<void>;

  /** Get current position */
  position(): number;

  /** Check if more items available */
  hasNext(): boolean;
}

/**
 * Time-based utilities
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Serializable data types
 */
export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

/**
 * Generic event emitter interface
 */
export interface EventEmitter<T = Record<string, unknown[]>> {
  on<K extends keyof T>(
    event: K,
    listener: (...args: T[K] extends unknown[] ? T[K] : never) => void,
  ): this;
  once<K extends keyof T>(
    event: K,
    listener: (...args: T[K] extends unknown[] ? T[K] : never) => void,
  ): this;
  off<K extends keyof T>(
    event: K,
    listener: (...args: T[K] extends unknown[] ? T[K] : never) => void,
  ): this;
  emit<K extends keyof T>(event: K, ...args: T[K] extends unknown[] ? T[K] : never): boolean;
}
