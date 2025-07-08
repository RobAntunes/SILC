/**
 * SILC Protocol Core Implementation
 * 
 * Main protocol class that orchestrates all SILC components for AI-native
 * communication using mathematical signal patterns.
 */

import type {
  ISILCSignal,
  ISILCMessage,
  SILCAgentID,
  SignalParameters
} from '../types/message.types';
import { SILCMessageType } from '../types/message.types';
import type { PerformanceMetrics, OperationResult } from '../types/common.types';
import type { EncodedSignal } from '../types/signal.types';

import { SILCConfig, ConfigLoader } from './config';
import { MessageBuilder } from './message-builder';
import { SILCError, ErrorHandler } from './errors';
import { SignalEncoder, SignalDecoder, SignalValidator, SILCSignal } from '../signal/index';
import { EventEmitter } from 'events';

/**
 * Protocol events
 */
interface SILCProtocolEvents {
  'signal.transmitted': [ISILCMessage, SILCAgentID];
  'signal.received': [ISILCMessage, SILCAgentID];
  'error': [SILCError];
  'performance.metrics': [PerformanceMetrics];
  'protocol.handshake': [SILCAgentID];
  'protocol.heartbeat': [SILCAgentID];
}

/**
 * Main SILC Protocol Class
 */
export class SILCProtocol extends EventEmitter<SILCProtocolEvents> {
  private config: SILCConfig;
  private messageBuilder: MessageBuilder;
  private signalProcessor: SILCSignal;
  private errorHandler: ErrorHandler;
  private isInitialized: boolean = false;
  private performanceMetrics: PerformanceMetrics;
  private connectionStatus = new Map<string, 'connected' | 'disconnected' | 'handshaking'>();

  constructor(config?: Partial<SILCConfig>) {
    super();
    
    // Load configuration
    this.config = config 
      ? { ...ConfigLoader.loadFromEnvironment(), ...config }
      : ConfigLoader.loadFromEnvironment();

    // Initialize components
    this.messageBuilder = new MessageBuilder({
      senderId: this.config.agent,
      defaultPriority: 0.618, // Golden ratio
      enableCompression: this.config.transport.enableCompression,
      defaultSampleRate: 44100
    });

    this.signalProcessor = new SILCSignal({
      compressionLevel: this.config.performance.compressionLevel,
      enableHarmonics: true,
      validateChecksums: this.config.security.enableIntegrityChecks,
      strictValidation: this.config.errorHandling.logLevel === 'DEBUG'
    });

    this.errorHandler = new ErrorHandler(this.config.errorHandling.maxRetries);

    // Initialize performance metrics
    this.performanceMetrics = this.initializeMetrics();

    // Set up error handling
    this.errorHandler = new ErrorHandler(this.config.errorHandling.maxRetries);
  }

  /**
   * Initialize the SILC protocol
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new SILCError(
        'Protocol already initialized',
        'protocol.invalid_format',
        2,
        101
      );
    }

    try {
      // Validate configuration
      this.validateConfiguration();

      // Initialize components
      await this.initializeComponents();

      this.isInitialized = true;

      if (this.config.options.debug) {
        console.log(`SILC Protocol v${this.config.protocol.version} initialized`);
        console.log(`Agent: ${this.config.agent.namespace}/${this.config.agent.modelType}:${this.config.agent.instanceId}`);
      }
    } catch (error) {
      const silcError = SILCError.fromError(
        error as Error,
        'protocol.invalid_format',
        4,
        101
      );
      
      this.emit('error', silcError);
      throw silcError;
    }
  }

  /**
   * Create a new SILC signal
   */
  public createSignal(params: SignalParameters): ISILCSignal {
    this.ensureInitialized();
    
    const startTime = performance.now();
    
    try {
      const signal = this.signalProcessor.create(params);
      
      // Update performance metrics
      this.updateLatencyMetric('signalEncoding', performance.now() - startTime);
      
      return signal;
    } catch (error) {
      this.handleError(error as Error, 'createSignal');
      throw error;
    }
  }

  /**
   * Transmit a signal to another AI agent
   */
  public async transmit(
    signal: ISILCSignal,
    targetAgentId: SILCAgentID,
    messageType: SILCMessageType = SILCMessageType.SIGNAL_TRANSFER
  ): Promise<OperationResult<string>> {
    this.ensureInitialized();
    
    return this.errorHandler.handle(async () => {
      const startTime = performance.now();
      
      // Build message
      const message = this.messageBuilder.build({
        signal,
        receiverId: targetAgentId,
        messageType
      });

      // Encode signal
      const encodedSignal = this.signalProcessor.encode(signal);
      
      // Update message checksum with encoded signal
      this.messageBuilder.updateChecksum(message, encodedSignal.encoded);

      // Transmit message (placeholder - will be implemented in transport layer)
      await this.transmitMessage(message);

      // Update performance metrics
      const duration = performance.now() - startTime;
      this.updateLatencyMetric('transmission', duration);
      this.updateThroughputMetric('messages', 1);

      // Emit event
      this.emit('signal.transmitted', message, targetAgentId);

      return {
        success: true,
        data: message.header.messageId,
        metadata: {
          duration,
          retries: 0,
          timestamp: Date.now()
        }
      };
    }, `transmit-${targetAgentId.instanceId}`);
  }

  /**
   * Receive signals from other AI agents
   */
  public async receive(
    filter?: { fromAgent?: SILCAgentID; messageType?: SILCMessageType }
  ): Promise<OperationResult<ISILCSignal>> {
    this.ensureInitialized();
    
    return this.errorHandler.handle(async () => {
      const startTime = performance.now();
      
      // Receive message (placeholder - will be implemented in transport layer)
      const message = await this.receiveMessage(filter);
      
      // Decode signal
      const signal = message.signal;
      
      // Validate signal
      const validation = this.signalProcessor.validate(signal);
      if (!validation.valid && this.config.errorHandling.logLevel === 'DEBUG') {
        throw new SILCError(
          `Received invalid signal: ${validation.errors.join(', ')}`,
          'signal.corruption',
          3,
          201
        );
      }

      // Update performance metrics
      const duration = performance.now() - startTime;
      this.updateLatencyMetric('reception', duration);

      // Emit event
      this.emit('signal.received', message, message.header.senderId);

      return {
        success: true,
        data: signal,
        metadata: {
          duration,
          retries: 0,
          timestamp: Date.now()
        }
      };
    }, 'receive');
  }

  /**
   * Perform handshake with another AI agent
   */
  public async handshake(targetAgentId: SILCAgentID): Promise<OperationResult<boolean>> {
    this.ensureInitialized();
    
    const agentKey = `${targetAgentId.namespace}:${targetAgentId.instanceId}`;
    this.connectionStatus.set(agentKey, 'handshaking');

    try {
      // Create handshake message
      const handshakeMessage = this.messageBuilder.buildHandshake(
        targetAgentId,
        this.config.agent.capabilities
      );

      // Send handshake
      await this.transmitMessage(handshakeMessage);

      // Wait for handshake response (simplified)
      // In full implementation, this would wait for a response
      this.connectionStatus.set(agentKey, 'connected');

      this.emit('protocol.handshake', targetAgentId);

      return {
        success: true,
        data: true,
        metadata: {
          duration: 0,
          retries: 0,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      this.connectionStatus.set(agentKey, 'disconnected');
      throw error;
    }
  }

  /**
   * Send heartbeat to maintain connection
   */
  public async heartbeat(targetAgentId: SILCAgentID): Promise<void> {
    this.ensureInitialized();
    
    const heartbeatMessage = this.messageBuilder.buildHeartbeat(targetAgentId);
    await this.transmitMessage(heartbeatMessage);
    
    this.emit('protocol.heartbeat', targetAgentId);
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get agent information
   */
  public getAgentInfo(): SILCAgentID {
    return { ...this.config.agent };
  }

  /**
   * Get connection status for an agent
   */
  public getConnectionStatus(agentId: SILCAgentID): 'connected' | 'disconnected' | 'handshaking' | 'unknown' {
    const key = `${agentId.namespace}:${agentId.instanceId}`;
    return this.connectionStatus.get(key) ?? 'unknown';
  }

  /**
   * Shutdown the protocol
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Send disconnect messages to connected agents
      for (const [agentKey, status] of this.connectionStatus.entries()) {
        if (status === 'connected') {
          // Send disconnect signal (simplified)
          // In full implementation, this would send proper disconnect messages
        }
      }

      // Clear connections
      this.connectionStatus.clear();

      // Reset state
      this.isInitialized = false;

      if (this.config.options.debug) {
        console.log('SILC Protocol shutdown complete');
      }
    } catch (error) {
      this.handleError(error as Error, 'shutdown');
    }
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    if (!this.config.agent.namespace || !this.config.agent.modelType || !this.config.agent.instanceId) {
      throw new Error('Agent configuration incomplete');
    }

    if (this.config.memory.windowSize <= 0) {
      throw new Error('Invalid memory window size');
    }

    if (this.config.performance.compressionLevel < 0 || this.config.performance.compressionLevel > 9) {
      throw new Error('Invalid compression level');
    }
  }

  /**
   * Initialize protocol components
   */
  private async initializeComponents(): Promise<void> {
    // Initialize signal processing components
    // This is where we would initialize memory managers, transport layers, etc.
    
    // For now, just mark as initialized
    await Promise.resolve();
  }

  /**
   * Placeholder for message transmission
   */
  private async transmitMessage(message: ISILCMessage): Promise<void> {
    // This will be implemented in the transport layer
    // For now, just simulate transmission
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  /**
   * Placeholder for message reception
   */
  private async receiveMessage(
    filter?: { fromAgent?: SILCAgentID; messageType?: SILCMessageType }
  ): Promise<ISILCMessage> {
    // This will be implemented in the transport layer
    // For now, return a mock message
    return this.messageBuilder.build({
      signal: { amplitude: 0.8, frequency: 3, phase: 0 },
      receiverId: this.config.agent,
      messageType: SILCMessageType.SIGNAL_TRANSFER
    });
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      latency: {
        signalEncoding: 0,
        signalDecoding: 0,
        transmission: 0,
        reception: 0
      },
      throughput: {
        signalsPerSecond: 0,
        bytesPerSecond: 0,
        messagesPerSecond: 0
      },
      memory: {
        allocated: 0,
        peak: 0,
        fragmentation: 0
      },
      errors: {
        rate: 0,
        total: 0,
        byCategory: {} as Record<string, number>
      },
      resources: {
        cpu: 0,
        memory: 0,
        network: 0
      }
    };
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetric(operation: keyof PerformanceMetrics['latency'], duration: number): void {
    // Exponential moving average
    const alpha = 0.1;
    this.performanceMetrics.latency[operation] = 
      alpha * duration + (1 - alpha) * this.performanceMetrics.latency[operation];
  }

  /**
   * Update throughput metrics
   */
  private updateThroughputMetric(type: 'signals' | 'bytes' | 'messages', count: number): void {
    // Simple rate calculation (simplified)
    switch (type) {
      case 'signals':
        this.performanceMetrics.throughput.signalsPerSecond += count;
        break;
      case 'bytes':
        this.performanceMetrics.throughput.bytesPerSecond += count;
        break;
      case 'messages':
        this.performanceMetrics.throughput.messagesPerSecond += count;
        break;
    }
  }

  /**
   * Handle errors with logging and metrics
   */
  private handleError(error: Error, operation: string): void {
    const silcError = error instanceof SILCError 
      ? error 
      : SILCError.fromError(error, SILCErrorCategory.SYSTEM_FAILURE, 2, 603, { operation });

    // Update error metrics
    this.performanceMetrics.errors.total++;
    this.performanceMetrics.errors.byCategory[silcError.category] = 
      (this.performanceMetrics.errors.byCategory[silcError.category] ?? 0) + 1;

    // Log error if enabled
    if (this.config.options.debug) {
      console.error(`SILC Error in ${operation}:`, silcError.getDescription());
    }

    // Emit error event
    this.emit('error', silcError);
  }

  /**
   * Ensure protocol is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new SILCError(
        'Protocol not initialized. Call initialize() first.',
        'protocol.invalid_format',
        3,
        101
      );
    }
  }
}