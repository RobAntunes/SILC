/**
 * SILC Protocol Type Definitions
 * 
 * This module exports all type definitions used throughout the SILC protocol implementation.
 */

// Signal types
export type {
  ISILCSignal,
  SignalParameters,
  HarmonicCoefficients,
  EncodedSignal,
  SignalValidationResult,
  CompressionInfo,
  SignalEncodingFormat,
  SignalQualityMetrics,
} from './signal.types';

// Message types
export type {
  ISILCMessage,
  ISILCHeader,
  SILCAgentID,
  DialectExtension,
  MessageMetadata,
  MessageBuilderConfig,
  MessageRouting,
} from './message.types';

// Common types
export type {
  SILCError,
  PerformanceMetrics,
  ConfigurationOptions,
  ErrorHandler,
  MetricsCallback,
  SignalCallback,
  OperationResult,
  SILCAsyncIterator,
  TimeRange,
  SerializableValue,
  EventEmitter,
} from './common.types';

// Re-export enums as both types and values
export { SILCMessageType } from './message.types';
export type { SILCMessageType as SILCMessageTypeType } from './message.types';
export { SILCErrorCategory, ErrorSeverity } from './common.types';

// Memory types (to be implemented)
export type {
  MemoryWindowConfig,
  SharedMemoryLayout,
} from './memory.types';

// Dialect types (to be implemented)
export type {
  IDialectPattern,
  PatternDiscoveryConfig,
  CrossDialectTranslation,
} from './dialect.types';

// Transport types (to be implemented)
export type {
  TransportConfig,
  StreamConfig,
  ParallelSegment,
} from './transport.types';

// Security types (to be implemented)
export type {
  SecurityConfig,
  EncryptionConfig,
  AuthenticationResult,
} from './security.types';