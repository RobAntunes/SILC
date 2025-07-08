/**
 * Transport layer type definitions for SILC Protocol
 * 
 * Defines interfaces for local and remote transport of SILC signals
 * using SharedArrayBuffer for zero-latency local communication.
 */

import type { ISILCSignal, EncodedSignal } from './signal.types';
import type { ISILCMessage } from './message.types';
import type { ISharedMemoryWindow } from './memory.types';

/**
 * Transport configuration
 */
export interface TransportConfig {
  /** Transport type */
  type: 'local' | 'remote' | 'hybrid';
  
  /** Local memory configuration */
  local?: {
    windowSize: number;
    maxWindows: number;
    useSharedArrayBuffer: boolean;
  };
  
  /** Remote transport configuration */
  remote?: {
    protocol: 'tcp' | 'udp' | 'websocket';
    host: string;
    port: number;
    encryption: boolean;
  };
  
  /** Performance settings */
  performance: {
    timeout: number;
    retryAttempts: number;
    compression: boolean;
  };
}

/**
 * Parallel stream configuration
 */
export interface StreamConfig {
  /** Unique stream identifier */
  streamId: string;
  
  /** Number of parallel segments */
  segmentCount: number;
  
  /** Segment size in bytes */
  segmentSize: number;
  
  /** Transmission mode */
  mode: 'parallel' | 'sequential' | 'adaptive';
  
  /** Quality of service settings */
  qos: {
    priority: number;
    reliability: 'best-effort' | 'reliable' | 'ordered';
    latencyTarget: number;
  };
}

/**
 * Parallel segment structure
 */
export interface ParallelSegment {
  /** Segment identification */
  segmentId: string;
  segmentIndex: number;
  totalSegments: number;
  
  /** Data information */
  segmentSize: number;
  relativeOffset: number;
  signalData: Uint8Array;
  
  /** Dependencies and ordering */
  dependencies: number[];
  priority: number;
  timestamp: number;
  
  /** Integrity verification */
  checksum: string;
  completionFlag: boolean;
  
  /** Assembly hints */
  assemblyHint?: {
    nextSegmentHint?: number;
    orderingRequired: boolean;
    assemblyMethod: 'immediate' | 'batch' | 'adaptive';
  };
}

/**
 * Transport endpoint identifier
 */
export interface TransportEndpoint {
  /** Unique endpoint ID */
  id: string;
  /** Endpoint type */
  type: 'local' | 'remote' | 'bridge';
  /** Connection metadata */
  metadata?: Record<string, any>;
}

/**
 * Transport connection state
 */
export enum TransportState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  HANDSHAKING = 'handshaking',
  READY = 'ready',
  ERROR = 'error',
  CLOSING = 'closing'
}

/**
 * Transport options
 */
export interface TransportOptions {
  /** Enable encryption */
  encryption?: boolean;
  /** Connection timeout in ms */
  timeout?: number;
  /** Max retry attempts */
  maxRetries?: number;
  /** Enable compression */
  compression?: boolean;
  /** Buffer size for streaming */
  bufferSize?: number;
}

/**
 * Transport statistics
 */
export interface TransportStats {
  /** Messages sent */
  messagesSent: number;
  /** Messages received */
  messagesReceived: number;
  /** Bytes sent */
  bytesSent: number;
  /** Bytes received */
  bytesReceived: number;
  /** Average latency in ms */
  averageLatency: number;
  /** Connection uptime in ms */
  uptime: number;
  /** Error count */
  errors: number;
}

/**
 * Transport event types
 */
export interface TransportEvents {
  'connected': (endpoint: TransportEndpoint) => void;
  'disconnected': (endpoint: TransportEndpoint, reason?: string) => void;
  'message': (message: ISILCMessage, from: TransportEndpoint) => void;
  'signal': (signal: ISILCSignal, from: TransportEndpoint) => void;
  'error': (error: Error, endpoint?: TransportEndpoint) => void;
  'state-change': (oldState: TransportState, newState: TransportState) => void;
}

/**
 * Base transport interface
 */
export interface ITransport {
  /** Current state */
  readonly state: TransportState;
  
  /** Transport statistics */
  readonly stats: TransportStats;
  
  /** Connect to endpoint */
  connect(endpoint: TransportEndpoint, options?: TransportOptions): Promise<void>;
  
  /** Disconnect from endpoint */
  disconnect(endpoint: TransportEndpoint): Promise<void>;
  
  /** Send message */
  send(message: ISILCMessage, to: TransportEndpoint): Promise<void>;
  
  /** Broadcast message */
  broadcast(message: ISILCMessage): Promise<void>;
  
  /** Check if endpoint is connected */
  isConnected(endpoint: TransportEndpoint): boolean;
  
  /** Get all connected endpoints */
  getEndpoints(): TransportEndpoint[];
  
  /** Shutdown transport */
  shutdown(): Promise<void>;
}

/**
 * Local transport using SharedArrayBuffer
 */
export interface ILocalTransport extends ITransport {
  /** Create memory window for endpoint */
  createWindow(endpoint: TransportEndpoint): Promise<ISharedMemoryWindow>;
  
  /** Discover local endpoints */
  discover(): Promise<TransportEndpoint[]>;
  
  /** Register for discovery */
  register(endpoint: TransportEndpoint): Promise<void>;
  
  /** Unregister from discovery */
  unregister(endpoint: TransportEndpoint): Promise<void>;
}

/**
 * Transport discovery service
 */
export interface ITransportDiscovery {
  /** Start discovery service */
  start(): Promise<void>;
  
  /** Stop discovery service */
  stop(): Promise<void>;
  
  /** Register endpoint */
  register(endpoint: TransportEndpoint): Promise<void>;
  
  /** Unregister endpoint */
  unregister(endpoint: TransportEndpoint): Promise<void>;
  
  /** Find endpoints by criteria */
  find(criteria?: Partial<TransportEndpoint>): Promise<TransportEndpoint[]>;
  
  /** Subscribe to endpoint changes */
  subscribe(callback: (endpoints: TransportEndpoint[]) => void): () => void;
}

/**
 * Transport notification
 */
export interface TransportNotification {
  /** Notification type */
  type: 'signal' | 'message' | 'handshake' | 'heartbeat';
  /** Window ID containing the data */
  windowId: bigint;
  /** Sender endpoint */
  from: TransportEndpoint;
  /** Timestamp */
  timestamp: number;
}

/**
 * Transport handshake data
 */
export interface TransportHandshake {
  /** Protocol version */
  version: string;
  /** Agent capabilities */
  capabilities: string[];
  /** Supported dialects */
  dialects: string[];
  /** Authentication data */
  auth?: any;
}