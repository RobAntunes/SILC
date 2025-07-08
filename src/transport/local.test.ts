/**
 * Unit tests for LocalTransport
 */

import { LocalTransport } from './local';
import { TransportState } from '../types/transport.types';
import type { ISILCMessage, TransportEndpoint } from '../types';

// Mock BroadcastChannel if not available
if (typeof BroadcastChannel === 'undefined') {
  (global as any).BroadcastChannel = class {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    private static channels = new Map<string, Set<any>>();

    constructor(name: string) {
      this.name = name;
      if (!BroadcastChannel.channels.has(name)) {
        BroadcastChannel.channels.set(name, new Set());
      }
      BroadcastChannel.channels.get(name)!.add(this);
    }

    postMessage(data: any) {
      const channels = BroadcastChannel.channels.get(this.name);
      if (channels) {
        channels.forEach((channel) => {
          if (channel !== this && channel.onmessage) {
            setTimeout(() => {
              channel.onmessage({ data } as MessageEvent);
            }, 0);
          }
        });
      }
    }

    close() {
      const channels = BroadcastChannel.channels.get(this.name);
      if (channels) {
        channels.delete(this);
      }
    }

    addEventListener() {}
    removeEventListener() {}
  };
}

describe('LocalTransport', () => {
  let transport: LocalTransport;

  beforeEach(() => {
    transport = new LocalTransport();
  });

  afterEach(async () => {
    await transport.shutdown();
  });

  describe('initialization', () => {
    test('should start in disconnected state', () => {
      expect(transport.state).toBe(TransportState.DISCONNECTED);
    });

    test('should have empty connections', () => {
      expect(transport.getEndpoints()).toHaveLength(0);
    });

    test('should initialize stats', () => {
      expect(transport.stats.messagesSent).toBe(0);
      expect(transport.stats.messagesReceived).toBe(0);
      expect(transport.stats.errors).toBe(0);
    });
  });

  describe('connect', () => {
    test('should connect to endpoint', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);

      expect(transport.state).toBe(TransportState.READY);
      expect(transport.isConnected(endpoint)).toBe(true);
      expect(transport.getEndpoints()).toContainEqual(endpoint);
    });

    test('should emit connected event', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      const connectedPromise = new Promise<TransportEndpoint>((resolve) => {
        transport.once('connected', resolve);
      });

      await transport.connect(endpoint);
      const connectedEndpoint = await connectedPromise;

      expect(connectedEndpoint).toEqual(endpoint);
    });

    test('should reject duplicate connections', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);

      await expect(transport.connect(endpoint)).rejects.toThrow(/already connected/i);
    });

    test('should handle connection options', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint, {
        bufferSize: 131072, // 128KB
        timeout: 5000,
      });

      expect(transport.isConnected(endpoint)).toBe(true);
    });
  });

  describe('disconnect', () => {
    test('should disconnect from endpoint', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);
      await transport.disconnect(endpoint);

      expect(transport.isConnected(endpoint)).toBe(false);
      expect(transport.getEndpoints()).not.toContainEqual(endpoint);
    });

    test('should emit disconnected event', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);

      const disconnectedPromise = new Promise<[TransportEndpoint, string?]>((resolve) => {
        transport.once('disconnected', (ep, reason) => resolve([ep, reason]));
      });

      await transport.disconnect(endpoint);
      const [disconnectedEndpoint, reason] = await disconnectedPromise;

      expect(disconnectedEndpoint).toEqual(endpoint);
      expect(reason).toBe('User requested');
    });

    test('should handle non-existent endpoint', async () => {
      const endpoint: TransportEndpoint = {
        id: 'non-existent',
        type: 'local',
      };

      // Should not throw
      await expect(transport.disconnect(endpoint)).resolves.toBeUndefined();
    });
  });

  describe('send', () => {
    test('should send message to connected endpoint', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);

      const message: ISILCMessage = {
        header: {
          version: '1.0.0',
          timestamp: Date.now(),
          sequenceNumber: 1,
          messageId: 'test-message',
          checksum: 'abc123',
        },
        signals: [],
        routing: {
          source: { id: 'self', type: 'test', instance: 'test' },
          destination: { id: 'test-endpoint', type: 'test', instance: 'test' },
        },
      };

      await transport.send(message, endpoint);

      expect(transport.stats.messagesSent).toBe(1);
      expect(transport.stats.bytesSent).toBeGreaterThan(0);
    });

    test('should reject send to disconnected endpoint', async () => {
      const endpoint: TransportEndpoint = {
        id: 'not-connected',
        type: 'local',
      };

      const message: ISILCMessage = {
        header: {
          version: '1.0.0',
          timestamp: Date.now(),
          sequenceNumber: 1,
          messageId: 'test-message',
          checksum: 'abc123',
        },
        signals: [],
        routing: {
          source: { id: 'self', type: 'test', instance: 'test' },
          destination: { id: 'test-endpoint', type: 'test', instance: 'test' },
        },
      };

      await expect(transport.send(message, endpoint)).rejects.toThrow(/not connected/i);
    });
  });

  describe('broadcast', () => {
    test('should broadcast to all connected endpoints', async () => {
      const endpoints: TransportEndpoint[] = [
        { id: 'endpoint1', type: 'local' },
        { id: 'endpoint2', type: 'local' },
        { id: 'endpoint3', type: 'local' },
      ];

      // Connect all endpoints
      await Promise.all(endpoints.map((ep) => transport.connect(ep)));

      const message: ISILCMessage = {
        header: {
          version: '1.0.0',
          timestamp: Date.now(),
          sequenceNumber: 1,
          messageId: 'broadcast-message',
          checksum: 'xyz789',
        },
        signals: [],
        routing: {
          source: { id: 'self', type: 'test', instance: 'test' },
          destination: { id: '*', type: 'broadcast', instance: '*' },
        },
      };

      await transport.broadcast(message);

      expect(transport.stats.messagesSent).toBe(3);
    });

    test('should handle empty connections', async () => {
      const message: ISILCMessage = {
        header: {
          version: '1.0.0',
          timestamp: Date.now(),
          sequenceNumber: 1,
          messageId: 'test-message',
          checksum: 'abc123',
        },
        signals: [],
        routing: {
          source: { id: 'self', type: 'test', instance: 'test' },
          destination: { id: '*', type: 'broadcast', instance: '*' },
        },
      };

      // Should not throw with no connections
      await expect(transport.broadcast(message)).resolves.toBeUndefined();
    });
  });

  describe('discovery', () => {
    test('should discover endpoints', async () => {
      // In a real implementation, other transports would register
      const endpoints = await transport.discover();

      // Should return array (empty in this test)
      expect(Array.isArray(endpoints)).toBe(true);
    });

    test('should register for discovery', async () => {
      const endpoint: TransportEndpoint = {
        id: 'discoverable',
        type: 'local',
        metadata: { name: 'Test Agent' },
      };

      await transport.register(endpoint);

      // In real implementation, other transports could discover this
    });
  });

  describe('window management', () => {
    test('should create window for endpoint', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      const window = await transport.createWindow(endpoint);

      expect(window).toBeDefined();
      expect(window.id).toBeDefined();
      expect(window.size).toBeGreaterThan(0);
    });
  });

  describe('state management', () => {
    test('should emit state change events', async () => {
      const stateChanges: Array<[TransportState, TransportState]> = [];

      transport.on('state-change', (oldState, newState) => {
        stateChanges.push([oldState, newState]);
      });

      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);

      expect(stateChanges).toContainEqual([TransportState.DISCONNECTED, TransportState.CONNECTING]);
      expect(stateChanges).toContainEqual([TransportState.CONNECTING, TransportState.READY]);
    });
  });

  describe('error handling', () => {
    test('should track errors', async () => {
      // Force an error by sending to non-existent endpoint
      const endpoint: TransportEndpoint = {
        id: 'non-existent',
        type: 'local',
      };

      const message: ISILCMessage = {
        header: {
          version: '1.0.0',
          timestamp: Date.now(),
          sequenceNumber: 1,
          messageId: 'test',
          checksum: 'test',
        },
        signals: [],
        routing: {
          source: { id: 'self', type: 'test', instance: 'test' },
          destination: { id: 'test', type: 'test', instance: 'test' },
        },
      };

      // Expect send to fail and increment error counter
      await expect(transport.send(message, endpoint)).rejects.toThrow(/not connected/i);
      expect(transport.stats.errors).toBeGreaterThan(0);
    });
  });

  describe('shutdown', () => {
    test('should disconnect all endpoints', async () => {
      const endpoints: TransportEndpoint[] = [
        { id: 'endpoint1', type: 'local' },
        { id: 'endpoint2', type: 'local' },
      ];

      await Promise.all(endpoints.map((ep) => transport.connect(ep)));

      expect(transport.getEndpoints()).toHaveLength(2);

      await transport.shutdown();

      expect(transport.getEndpoints()).toHaveLength(0);
      expect(transport.state).toBe(TransportState.DISCONNECTED);
    });

    test('should clean up resources', async () => {
      const endpoint: TransportEndpoint = {
        id: 'test-endpoint',
        type: 'local',
      };

      await transport.connect(endpoint);
      await transport.shutdown();

      // Verify cleaned up
      expect(transport.isConnected(endpoint)).toBe(false);
    });
  });
});
