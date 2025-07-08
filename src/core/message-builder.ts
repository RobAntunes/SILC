/**
 * SILC Message Builder
 *
 * Constructs SILC protocol messages with proper headers, routing,
 * and metadata for AI-to-AI communication.
 */

import type {
  DialectExtension,
  ISILCHeader,
  ISILCMessage,
  ISILCSignal,
  MessageBuilderConfig,
  MessageMetadata,
  SILCAgentID,
} from '../types/message.types';
import { SILCMessageType } from '../types/message.types';
import type { CompressionInfo } from '../types/signal.types';
import type { ErrorSeverity, SILCError, SILCErrorCategory } from '../types/common.types';
import { createHash, randomUUID } from 'crypto';

/**
 * Default message builder configuration
 */
const DEFAULT_CONFIG: MessageBuilderConfig = {
  senderId: {
    namespace: 'silc',
    modelType: 'unknown',
    instanceId: 'default',
    dialectVersion: '1.0.0',
    capabilities: ['base-spec'],
  },
  defaultPriority: 0.618, // Golden ratio priority
  enableCompression: true,
  defaultSampleRate: 44100,
};

/**
 * SILC Message Builder Class
 */
export class MessageBuilder {
  private config: MessageBuilderConfig;
  private sequenceCounter: number = 0;

  constructor(config: Partial<MessageBuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build a complete SILC message
   */
  public build(options: {
    signal: ISILCSignal;
    receiverId: SILCAgentID;
    messageType?: SILCMessageType;
    dialect?: DialectExtension;
    metadata?: Partial<MessageMetadata>;
    priority?: number;
    compression?: CompressionInfo;
  }): ISILCMessage {
    // Generate message ID and timestamp
    const messageId = randomUUID();
    const timestamp = this.getHighPrecisionTimestamp();

    // Calculate signal properties
    const signalLength = this.calculateSignalLength(options.signal);
    const compression = options.compression ?? this.getDefaultCompression();

    // Build header
    const header = this.buildHeader({
      messageId,
      timestamp,
      senderId: this.config.senderId,
      receiverId: options.receiverId,
      messageType: options.messageType ?? SILCMessageType.SIGNAL_TRANSFER,
      signalLength,
      compression,
      priority: options.priority ?? this.config.defaultPriority,
    });

    // Build complete message
    const message: ISILCMessage = {
      header,
      signal: options.signal,
      dialect: options.dialect,
      metadata: this.buildMetadata(options.metadata),
    };

    // Validate message
    this.validateMessage(message);

    return message;
  }

  /**
   * Build message header with all required fields
   */
  public buildHeader(options: {
    messageId: string;
    timestamp: number;
    senderId: SILCAgentID;
    receiverId: SILCAgentID;
    messageType: SILCMessageType;
    signalLength: number;
    compression: CompressionInfo;
    priority: number;
  }): ISILCHeader {
    // Calculate checksum placeholder (will be updated after signal encoding)
    const checksum = this.calculateHeaderChecksum(options);

    const header: ISILCHeader = {
      // Protocol identification
      protocol: 'SILC',
      version: '1.0.0',

      // Message identity
      messageId: options.messageId,
      timestamp: options.timestamp,
      sequenceNumber: this.getNextSequenceNumber(),

      // Routing information
      senderId: options.senderId,
      receiverId: options.receiverId,
      messageType: options.messageType,

      // Signal properties
      signalLength: options.signalLength,
      sampleRate: this.config.defaultSampleRate,
      compression: options.compression,

      // Quality assurance
      checksum,
      priority: options.priority,
    };

    return header;
  }

  /**
   * Build handshake message for protocol negotiation
   */
  public buildHandshake(receiverId: SILCAgentID, capabilities: string[] = []): ISILCMessage {
    // Create a simple handshake signal
    const handshakeSignal: ISILCSignal = {
      amplitude: 1.0, // Full confidence
      frequency: 0, // Idle frequency for handshake
      phase: 0, // In-phase (agreement)
    };

    const metadata: Partial<MessageMetadata> = {
      priority: 'high',
      context: {
        conversationId: randomUUID(),
      },
      performance: {
        cacheable: false,
        ttl: 30000, // 30 second TTL for handshake
      },
    };

    return this.build({
      signal: handshakeSignal,
      receiverId,
      messageType: SILCMessageType.HANDSHAKE,
      metadata,
    });
  }

  /**
   * Build error message
   */
  public buildError(receiverId: SILCAgentID, originalMessageId?: string): ISILCMessage {
    // Create error signal with low confidence and high urgency
    const errorSignal: ISILCSignal = {
      amplitude: 0.25, // Low confidence (error state)
      frequency: 7, // High urgency
      phase: Math.PI, // Out-of-phase (disagreement/error)
    };

    const metadata: Partial<MessageMetadata> = {
      priority: 'critical',
      context: {
        parentMessageId: originalMessageId,
      },
    };

    return this.build({
      signal: errorSignal,
      receiverId,
      messageType: SILCMessageType.ERROR,
      metadata,
    });
  }

  /**
   * Build heartbeat message
   */
  public buildHeartbeat(receiverId: SILCAgentID): ISILCMessage {
    // Simple heartbeat signal
    const heartbeatSignal: ISILCSignal = {
      amplitude: 0.5, // Medium confidence
      frequency: 1, // Low urgency
      phase: 0, // In-phase
    };

    const metadata: Partial<MessageMetadata> = {
      priority: 'low',
      performance: {
        cacheable: false,
        ttl: 5000, // 5 second TTL
      },
    };

    return this.build({
      signal: heartbeatSignal,
      receiverId,
      messageType: SILCMessageType.HEARTBEAT,
      metadata,
    });
  }

  /**
   * Calculate signal length in samples
   */
  private calculateSignalLength(signal: ISILCSignal): number {
    // Base signal is always 1 sample
    let length = 1;

    // Add harmonic samples if present
    if (signal.harmonics) {
      length += signal.harmonics.length;
    }

    return length;
  }

  /**
   * Get default compression info
   */
  private getDefaultCompression(): CompressionInfo {
    return {
      algorithm: this.config.enableCompression ? 'zlib' : 'none',
      level: this.config.enableCompression ? 6 : 0,
      ratio: 1.0, // Will be updated after compression
    };
  }

  /**
   * Build message metadata
   */
  private buildMetadata(metadata: Partial<MessageMetadata> = {}): MessageMetadata {
    return {
      priority: metadata.priority ?? 'normal',
      expectedResponseTime: metadata.expectedResponseTime,
      context: metadata.context,
      security: metadata.security,
      performance: {
        cacheable: metadata.performance?.cacheable ?? true,
        ttl: metadata.performance?.ttl ?? 300000, // 5 minute default TTL
        compression: metadata.performance?.compression ?? this.config.enableCompression,
        ...metadata.performance,
      },
    };
  }

  /**
   * Calculate header checksum
   */
  private calculateHeaderChecksum(options: {
    messageId: string;
    timestamp: number;
    senderId: SILCAgentID;
    receiverId: SILCAgentID;
    messageType: SILCMessageType;
  }): string {
    const headerData = JSON.stringify({
      messageId: options.messageId,
      timestamp: options.timestamp,
      senderId: options.senderId,
      receiverId: options.receiverId,
      messageType: options.messageType,
    });

    return createHash('sha256').update(headerData).digest('hex').substring(0, 16); // 16 character checksum
  }

  /**
   * Get high precision timestamp in microseconds
   */
  private getHighPrecisionTimestamp(): number {
    const hrTime = process.hrtime.bigint();
    return Number(hrTime / 1000n); // Convert to microseconds
  }

  /**
   * Get next sequence number
   */
  private getNextSequenceNumber(): number {
    return ++this.sequenceCounter;
  }

  /**
   * Validate complete message
   */
  private validateMessage(message: ISILCMessage): void {
    // Validate header
    if (!message.header.messageId || !message.header.timestamp) {
      throw new Error('Message header missing required fields');
    }

    // Validate agent IDs
    this.validateAgentId(message.header.senderId, 'senderId');
    this.validateAgentId(message.header.receiverId, 'receiverId');

    // Validate signal
    if (!message.signal || typeof message.signal !== 'object') {
      throw new Error('Message missing valid signal');
    }

    // Validate dialect if present
    if (message.dialect) {
      this.validateDialect(message.dialect);
    }
  }

  /**
   * Validate agent ID structure
   */
  private validateAgentId(agentId: SILCAgentID, fieldName: string): void {
    if (!agentId.namespace || !agentId.modelType || !agentId.instanceId) {
      throw new Error(`Invalid ${fieldName}: missing required fields`);
    }

    if (!Array.isArray(agentId.capabilities)) {
      throw new Error(`Invalid ${fieldName}: capabilities must be array`);
    }
  }

  /**
   * Validate dialect extension
   */
  private validateDialect(dialect: DialectExtension): void {
    if (!dialect.dialectId || !dialect.version) {
      throw new Error('Dialect missing required identification fields');
    }

    if (!Array.isArray(dialect.patterns)) {
      throw new Error('Dialect patterns must be array');
    }
  }

  /**
   * Update message checksum after signal encoding
   */
  public updateChecksum(message: ISILCMessage, encodedSignal: string): void {
    const messageData = JSON.stringify({
      header: message.header,
      encodedSignal,
      dialect: message.dialect,
      metadata: message.metadata,
    });

    message.header.checksum = createHash('sha256')
      .update(messageData)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Create message from template
   */
  public fromTemplate(
    template: 'handshake' | 'heartbeat' | 'error',
    receiverId: SILCAgentID,
    additionalData?: unknown,
  ): ISILCMessage {
    switch (template) {
      case 'handshake':
        return this.buildHandshake(receiverId, additionalData as string[]);
      case 'heartbeat':
        return this.buildHeartbeat(receiverId);
      case 'error':
        return this.buildError(receiverId, additionalData as SILCError);
      default:
        throw new Error(`Unknown message template: ${template}`);
    }
  }

  /**
   * Clone message with new receiver
   */
  public cloneForReceiver(message: ISILCMessage, newReceiverId: SILCAgentID): ISILCMessage {
    const cloned = structuredClone(message);
    cloned.header.receiverId = newReceiverId;
    cloned.header.messageId = randomUUID();
    cloned.header.timestamp = this.getHighPrecisionTimestamp();
    cloned.header.sequenceNumber = this.getNextSequenceNumber();

    return cloned;
  }
}
