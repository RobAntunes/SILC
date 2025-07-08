/**
 * SILC Protocol - Self-Interpreting Local Communication
 *
 * The world's first AI-native communication protocol using mathematical signal patterns.
 *
 * @example
 * ```typescript
 * import { SILCProtocol } from 'silc-protocol';
 *
 * const silc = new SILCProtocol({
 *   agentId: {
 *     namespace: 'myapp',
 *     modelType: 'claude',
 *     instanceId: 'agent-001'
 *   }
 * });
 *
 * // Create a signal
 * const signal = silc.createSignal({
 *   amplitude: 0.85,    // High confidence
 *   frequency: 3,       // Normal urgency
 *   phase: 0,          // In-phase (agreement)
 *   harmonics: [0.618, 0.382] // Golden ratio harmonics
 * });
 *
 * // Transmit to another AI
 * await silc.transmit(signal, targetAgentId);
 * ```
 */

// Core exports
export { SILCProtocol } from './core/protocol';
export { SILCConfig } from './core/config';

// Signal processing exports
export { SILCSignal, SignalEncoder, SignalDecoder } from './signal';

// Memory management exports (Phase 2 - TODO)
// export {
//   MemoryManager,
//   SharedWindow,
// } from './memory';

// Dialect system exports (Phase 3 - TODO)
// export {
//   DialectRegistry,
//   DialectPattern,
//   PatternDiscoverer,
// } from './dialect';

// Transport layer exports (Phase 4 - TODO)
// export {
//   LocalTransport,
//   RemoteTransport,
//   ParallelStream,
// } from './transport';

// Security exports (Phase 5 - TODO)
// export {
//   SecurityManager,
//   EncryptionProvider,
// } from './security';

// Protocol bridge exports (Phase 6 - TODO)
// export {
//   A2ABridge,
//   NLIPBridge,
//   JSONRPCBridge,
// } from './bridge';

// Type definitions
export type {
  // Core types
  ISILCSignal,
  ISILCMessage,
  ISILCHeader,
  SILCAgentID,
  SILCMessageType,

  // Signal types
  SignalParameters,
  HarmonicCoefficients,
  SignalValidationResult,

  // Memory types
  MemoryWindowConfig,
  SharedMemoryLayout,

  // Dialect types
  IDialectPattern,
  PatternDiscoveryConfig,
  CrossDialectTranslation,

  // Transport types
  TransportConfig,
  StreamConfig,
  ParallelSegment,

  // Security types
  SecurityConfig,
  EncryptionConfig,
  AuthenticationResult,

  // Common types
  SILCError,
  PerformanceMetrics,
  ConfigurationOptions,
} from './types';

// Utility exports
export { MathConstants, SignalUtils, PerformanceUtils } from './utils';

// Version info
export const VERSION = '0.1.0';
export const PROTOCOL_VERSION = '1.0.0';

// Default configurations
export { DEFAULT_CONFIG, DEVELOPMENT_CONFIG, PRODUCTION_CONFIG } from './core';
