/**
 * Local Transport Implementation
 *
 * Uses SharedArrayBuffer for zero-latency communication between
 * AI agents in the same process or worker context.
 */

import { EventEmitter } from 'events';
import type {
  ILocalTransport,
  TransportEndpoint,
  TransportEvents,
  TransportNotification,
  TransportOptions,
  TransportStats,
} from '../types/transport.types';
import { TransportState } from '../types/transport.types';
import type { ISILCMessage } from '../types/message.types';
import type { ISharedMemoryWindow } from '../types/memory.types';
import { MemoryManager } from '../memory/manager';
import { SILCError } from '../core/errors';
import { ErrorSeverity, SILCErrorCategory } from '../types/common.types';

/**
 * Endpoint connection info
 */
interface EndpointConnection {
  endpoint: TransportEndpoint;
  window: ISharedMemoryWindow;
  lastActivity: number;
  state: TransportState;
}

/**
 * Local transport implementation
 */
export class LocalTransport extends EventEmitter<TransportEvents> implements ILocalTransport {
  private _state: TransportState = TransportState.DISCONNECTED;
  private readonly connections = new Map<string, EndpointConnection>();
  private readonly memoryManager: MemoryManager;
  private readonly notificationChannel: BroadcastChannel;
  private readonly discoveryChannel: BroadcastChannel;
  private readonly _stats: TransportStats;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    super();

    this.memoryManager = new MemoryManager({
      windowSize: 65536, // 64KB default
      windowCount: 100,
      adaptiveResize: true,
    });

    // Initialize notification channels
    this.notificationChannel = new BroadcastChannel('silc:transport:notifications');
    this.discoveryChannel = new BroadcastChannel('silc:transport:discovery');

    // Initialize statistics
    this._stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      averageLatency: 0,
      uptime: 0,
      errors: 0,
    };

    this.setupChannelHandlers();
  }

  /**
   * Get current transport state
   */
  get state(): TransportState {
    return this._state;
  }

  /**
   * Get transport statistics
   */
  get stats(): TransportStats {
    return { ...this._stats };
  }

  /**
   * Setup broadcast channel handlers
   */
  private setupChannelHandlers(): void {
    // Handle notifications
    this.notificationChannel.onmessage = (event) => {
      this.handleNotification(event.data as TransportNotification);
    };

    // Handle discovery
    this.discoveryChannel.onmessage = (event) => {
      if (event.data.type === 'announce') {
        this.handleEndpointAnnouncement(event.data.endpoint);
      }
    };
  }

  /**
   * Connect to an endpoint
   */
  async connect(endpoint: TransportEndpoint, options?: TransportOptions): Promise<void> {
    if (this.connections.has(endpoint.id)) {
      throw new SILCError(
        `Already connected to endpoint ${endpoint.id}`,
        SILCErrorCategory.TRANSPORT_ERROR,
        ErrorSeverity.LOW,
      );
    }

    this.setState(TransportState.CONNECTING);

    try {
      // Create shared memory window
      const windowResult = await this.memoryManager.allocateWindow(options?.bufferSize || 65536);

      if (!windowResult.success || !windowResult.data) {
        throw new Error(windowResult.error || 'Failed to allocate window');
      }

      const connection: EndpointConnection = {
        endpoint,
        window: windowResult.data,
        lastActivity: Date.now(),
        state: TransportState.CONNECTED,
      };

      this.connections.set(endpoint.id, connection);

      // Notify the endpoint
      const notification: TransportNotification = {
        type: 'handshake',
        windowId: windowResult.data.id,
        from: { id: 'self', type: 'local' },
        timestamp: Date.now(),
      };

      this.notificationChannel.postMessage(notification);

      this.setState(TransportState.READY);
      this.emit('connected', endpoint);

      // Start heartbeat if not already running
      if (!this.heartbeatInterval) {
        this.startHeartbeat();
      }
    } catch (error) {
      this.setState(TransportState.ERROR);
      this._stats.errors++;
      throw new SILCError(
        `Failed to connect to endpoint: ${error}`,
        SILCErrorCategory.TRANSPORT_ERROR,
        ErrorSeverity.HIGH,
      );
    }
  }

  /**
   * Disconnect from an endpoint
   */
  async disconnect(endpoint: TransportEndpoint): Promise<void> {
    const connection = this.connections.get(endpoint.id);
    if (!connection) {
      return;
    }

    this.setState(TransportState.CLOSING);

    // Release memory window
    await this.memoryManager.releaseWindow(connection.window.id);

    // Remove connection
    this.connections.delete(endpoint.id);

    // Update state
    if (this.connections.size === 0) {
      this.setState(TransportState.DISCONNECTED);
      this.stopHeartbeat();
    } else {
      this.setState(TransportState.READY);
    }

    this.emit('disconnected', endpoint, 'User requested');
  }

  /**
   * Send a message to an endpoint
   */
  async send(message: ISILCMessage, to: TransportEndpoint): Promise<void> {
    const connection = this.connections.get(to.id);
    if (!connection) {
      this._stats.errors++;
      throw new SILCError(
        `Not connected to endpoint ${to.id}`,
        SILCErrorCategory.TRANSPORT_ERROR,
        ErrorSeverity.HIGH,
      );
    }

    try {
      // Serialize message
      const messageData = JSON.stringify(message);
      const encoder = new TextEncoder();
      const data = encoder.encode(messageData);

      // Write to shared memory
      const writeResult = await connection.window.write(data);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Write failed');
      }

      // Send notification
      const notification: TransportNotification = {
        type: 'message',
        windowId: connection.window.id,
        from: { id: 'self', type: 'local' },
        timestamp: Date.now(),
      };

      this.notificationChannel.postMessage(notification);

      // Update stats
      this._stats.messagesSent++;
      this._stats.bytesSent += data.length;
      connection.lastActivity = Date.now();
    } catch (error) {
      this._stats.errors++;
      throw new SILCError(
        `Failed to send message: ${error}`,
        SILCErrorCategory.TRANSPORT_ERROR,
        ErrorSeverity.HIGH,
      );
    }
  }

  /**
   * Broadcast a message to all connected endpoints
   */
  async broadcast(message: ISILCMessage): Promise<void> {
    const promises = Array.from(this.connections.values()).map((conn) =>
      this.send(message, conn.endpoint),
    );

    await Promise.all(promises);
  }

  /**
   * Check if endpoint is connected
   */
  isConnected(endpoint: TransportEndpoint): boolean {
    return this.connections.has(endpoint.id);
  }

  /**
   * Get all connected endpoints
   */
  getEndpoints(): TransportEndpoint[] {
    return Array.from(this.connections.values()).map((conn) => conn.endpoint);
  }

  /**
   * Create memory window for endpoint
   */
  async createWindow(endpoint: TransportEndpoint): Promise<ISharedMemoryWindow> {
    const result = await this.memoryManager.allocateWindow();
    if (!result.success || !result.data) {
      throw new SILCError(
        'Failed to create window',
        SILCErrorCategory.MEMORY_ERROR,
        ErrorSeverity.HIGH,
      );
    }
    return result.data;
  }

  /**
   * Discover local endpoints
   */
  async discover(): Promise<TransportEndpoint[]> {
    return new Promise((resolve) => {
      const endpoints: TransportEndpoint[] = [];
      const timeout = setTimeout(() => {
        resolve(endpoints);
      }, 1000); // 1 second discovery timeout

      // Listen for announcements
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'announce') {
          endpoints.push(event.data.endpoint);
        }
      };

      this.discoveryChannel.addEventListener('message', handler);

      // Request announcements
      this.discoveryChannel.postMessage({ type: 'discover' });

      // Cleanup
      setTimeout(() => {
        this.discoveryChannel.removeEventListener('message', handler);
        clearTimeout(timeout);
      }, 1000);
    });
  }

  /**
   * Register for discovery
   */
  async register(endpoint: TransportEndpoint): Promise<void> {
    // Listen for discovery requests
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'discover') {
        this.discoveryChannel.postMessage({
          type: 'announce',
          endpoint,
        });
      }
    };

    this.discoveryChannel.addEventListener('message', handler);
  }

  /**
   * Unregister from discovery
   */
  async unregister(endpoint: TransportEndpoint): Promise<void> {
    // In a real implementation, we'd remove the handler
    // For now, just disconnect
    await this.disconnect(endpoint);
  }

  /**
   * Shutdown transport
   */
  async shutdown(): Promise<void> {
    this.setState(TransportState.CLOSING);

    // Disconnect all endpoints
    const endpoints = this.getEndpoints();
    await Promise.all(endpoints.map((ep) => this.disconnect(ep)));

    // Cleanup
    this.stopHeartbeat();
    this.notificationChannel.close();
    this.discoveryChannel.close();
    await this.memoryManager.destroy();

    this.setState(TransportState.DISCONNECTED);
  }

  /**
   * Handle incoming notification
   */
  private async handleNotification(notification: TransportNotification): Promise<void> {
    // Ignore self notifications
    if (notification.from.id === 'self') {
      return;
    }

    try {
      switch (notification.type) {
        case 'message':
        case 'signal':
          await this.handleIncomingData(notification);
          break;
        case 'handshake':
          await this.handleHandshake(notification);
          break;
        case 'heartbeat':
          this.updateEndpointActivity(notification.from.id);
          break;
      }
    } catch (error) {
      this._stats.errors++;
      this.emit('error', error as Error, notification.from);
    }
  }

  /**
   * Handle incoming data
   */
  private async handleIncomingData(notification: TransportNotification): Promise<void> {
    // Get window from memory manager
    const windowResult = await this.memoryManager.getWindow(notification.windowId);
    if (!windowResult.success || !windowResult.data) {
      throw new Error('Window not found');
    }

    // Read data
    const readResult = await windowResult.data.read();
    if (!readResult.success || !readResult.data) {
      throw new Error('Failed to read data');
    }

    // Decode message
    const decoder = new TextDecoder();
    const messageData = decoder.decode(readResult.data);
    const message = JSON.parse(messageData) as ISILCMessage;

    // Update stats
    this._stats.messagesReceived++;
    this._stats.bytesReceived += readResult.data.length;

    // Emit event
    this.emit('message', message, notification.from);

    if (notification.type === 'signal' && message.signals.length > 0) {
      this.emit('signal', message.signals[0], notification.from);
    }
  }

  /**
   * Handle handshake notification
   */
  private async handleHandshake(notification: TransportNotification): Promise<void> {
    // In a real implementation, we'd validate and establish the connection
    this.updateEndpointActivity(notification.from.id);
  }

  /**
   * Handle endpoint announcement
   */
  private handleEndpointAnnouncement(endpoint: TransportEndpoint): void {
    // Could emit an event for discovered endpoints
  }

  /**
   * Update endpoint activity timestamp
   */
  private updateEndpointActivity(endpointId: string): void {
    const connection = this.connections.get(endpointId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      // Send heartbeat to all connections
      this.connections.forEach((conn) => {
        const notification: TransportNotification = {
          type: 'heartbeat',
          windowId: conn.window.id,
          from: { id: 'self', type: 'local' },
          timestamp: Date.now(),
        };
        this.notificationChannel.postMessage(notification);
      });

      // Check for inactive connections
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      this.connections.forEach((conn, id) => {
        if (now - conn.lastActivity > timeout) {
          this.disconnect(conn.endpoint).catch((err) => {
            this.emit('error', err, conn.endpoint);
          });
        }
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Set transport state
   */
  private setState(newState: TransportState): void {
    const oldState = this._state;
    this._state = newState;
    this.emit('state-change', oldState, newState);
  }
}
