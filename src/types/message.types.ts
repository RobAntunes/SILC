/**
 * Message structure type definitions for SILC Protocol
 */

import type { CompressionInfo, ISILCSignal, SignalParameters } from './signal.types';

// Re-export types for use in other modules
export type { ISILCSignal, SignalParameters };

/**
 * SILC message structure
 */
export interface ISILCMessage {
  /** Message header with metadata */
  header: ISILCHeader;

  /** Signal payload */
  signal: ISILCSignal;

  /** Optional dialect extensions */
  dialect?: DialectExtension;

  /** Additional message metadata */
  metadata?: MessageMetadata;
}

/**
 * SILC message header
 */
export interface ISILCHeader {
  // Protocol identification
  protocol: 'SILC';
  version: string;

  // Message identity
  messageId: string;
  timestamp: number;
  sequenceNumber: number;

  // Routing information
  senderId: SILCAgentID;
  receiverId: SILCAgentID;
  messageType: SILCMessageType;

  // Signal properties
  signalLength: number;
  sampleRate: number;
  compression: CompressionInfo;

  // Quality assurance
  checksum: string;
  priority: number;
}

/**
 * Agent identification structure
 */
export interface SILCAgentID {
  /** Organization/project namespace */
  namespace: string;

  /** AI model type (claude, gpt4, gemini, etc.) */
  modelType: string;

  /** Unique instance identifier */
  instanceId: string;

  /** Supported dialect version */
  dialectVersion: string;

  /** Supported signal patterns */
  capabilities: string[];
}

/**
 * SILC message types
 */
export enum SILCMessageType {
  // Core communication
  SIGNAL_TRANSFER = 'signal.transfer',
  PATTERN_SYNC = 'signal.pattern_sync',
  CONFIDENCE_UPDATE = 'signal.confidence',

  // Memory operations
  MEMORY_COORDINATE = 'memory.coordinate',
  QUANTUM_STATE = 'memory.quantum_state',
  LEARNING_SYNC = 'memory.learning',

  // Collaboration
  TASK_COORDINATE = 'collab.task',
  INSIGHT_SHARE = 'collab.insight',
  SYNTHESIS_REQUEST = 'collab.synthesis',

  // Protocol management
  HANDSHAKE = 'protocol.handshake',
  CAPABILITY_DISCOVERY = 'protocol.discovery',
  DIALECT_NEGOTIATION = 'protocol.dialect',
  HEARTBEAT = 'protocol.heartbeat',
  ERROR = 'protocol.error',
}

/**
 * Dialect extension for specialized patterns
 */
export interface DialectExtension {
  /** Dialect name and version */
  dialectId: string;
  version: string;

  /** Specialized patterns used */
  patterns: string[];

  /** Pattern-specific metadata */
  patternData: Record<string, unknown>;

  /** Fallback to base spec if needed */
  baseSpecFallback: boolean;
}

/**
 * Additional message metadata
 */
export interface MessageMetadata {
  /** Message priority level */
  priority: 'low' | 'normal' | 'high' | 'critical';

  /** Expected response time */
  expectedResponseTime?: number;

  /** Message context information */
  context?: {
    conversationId?: string;
    taskId?: string;
    parentMessageId?: string;
  };

  /** Security metadata */
  security?: {
    encrypted: boolean;
    signed: boolean;
    keyId?: string;
  };

  /** Performance hints */
  performance?: {
    cacheable: boolean;
    ttl?: number;
    compression?: boolean;
  };
}

/**
 * Message builder configuration
 */
export interface MessageBuilderConfig {
  /** Default sender agent ID */
  senderId: SILCAgentID;

  /** Default message priority */
  defaultPriority: number;

  /** Enable compression by default */
  enableCompression: boolean;

  /** Default sample rate */
  defaultSampleRate: number;
}

/**
 * Message routing information
 */
export interface MessageRouting {
  /** Source agent */
  from: SILCAgentID;

  /** Destination agent */
  to: SILCAgentID;

  /** Routing path (for multi-hop) */
  path?: SILCAgentID[];

  /** Time-to-live */
  ttl?: number;
}
