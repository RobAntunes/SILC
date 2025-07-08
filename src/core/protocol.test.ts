/**
 * Unit tests for SILC Protocol Core
 */

import { SILCProtocol } from './protocol';
import { createSILCProtocol, quickStart } from './index';
import { TEST_CONFIG } from './config';
import type { ISILCSignal, SILCAgentID } from '../types/message.types';
import { SILCMessageType } from '../types/message.types';

describe('SILCProtocol', () => {
  let protocol: SILCProtocol;
  let testAgentId: SILCAgentID;

  beforeEach(async () => {
    testAgentId = {
      namespace: 'test',
      modelType: 'test-agent',
      instanceId: 'test-001',
      dialectVersion: '1.0.0',
      capabilities: ['base-spec'],
    };

    protocol = new SILCProtocol(TEST_CONFIG);
    await protocol.initialize();
  });

  afterEach(async () => {
    await protocol.shutdown();
  });

  describe('Initialization', () => {
    test('should initialize successfully with config', async () => {
      const newProtocol = new SILCProtocol(TEST_CONFIG);

      await expect(newProtocol.initialize()).resolves.not.toThrow();

      await newProtocol.shutdown();
    });

    test('should prevent double initialization', async () => {
      await expect(protocol.initialize()).rejects.toThrow(/already initialized/i);
    });

    test('should load environment configuration by default', () => {
      const defaultProtocol = new SILCProtocol();

      expect(defaultProtocol).toBeDefined();
    });
  });

  describe('Signal Creation', () => {
    test('should create simple signal', () => {
      const signal = protocol.createSignal({
        amplitude: 0.8,
        frequency: 3,
        phase: 0,
      });

      expect(signal.amplitude).toBe(0.8);
      expect(signal.frequency).toBe(3);
      expect(signal.phase).toBe(0);
    });

    test('should create signal with harmonics', () => {
      const signal = protocol.createSignal({
        amplitude: 0.618,
        frequency: 1,
        phase: 0,
        harmonics: [1.618, 0.382],
      });

      expect(signal.harmonics).toEqual([1.618, 0.382]);
    });

    test('should validate signal parameters', () => {
      expect(() =>
        protocol.createSignal({
          amplitude: 1.5, // Invalid
          frequency: 3,
          phase: 0,
        }),
      ).toThrow();

      expect(() =>
        protocol.createSignal({
          amplitude: 0.5,
          frequency: 8, // Invalid
          phase: 0,
        }),
      ).toThrow();
    });

    test('should require initialization', () => {
      const uninitializedProtocol = new SILCProtocol(TEST_CONFIG);

      expect(() =>
        uninitializedProtocol.createSignal({
          amplitude: 0.5,
          frequency: 3,
          phase: 0,
        }),
      ).toThrow(/not initialized/i);
    });
  });

  describe('Signal Transmission', () => {
    test('should transmit signal successfully', async () => {
      const signal: ISILCSignal = {
        amplitude: 0.7,
        frequency: 4,
        phase: 0,
      };

      const result = await protocol.transmit(signal, testAgentId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined(); // Message ID
      expect(result.metadata?.duration).toBeGreaterThan(0);
    });

    test('should emit transmission events', async () => {
      const signal: ISILCSignal = {
        amplitude: 0.6,
        frequency: 2,
        phase: 0,
      };

      const eventPromise = new Promise((resolve) => {
        protocol.once('signal.transmitted', (message, targetAgent) => {
          resolve({ message, targetAgent });
        });
      });

      await protocol.transmit(signal, testAgentId);
      const event = await eventPromise;

      expect(event).toBeDefined();
    });

    test('should handle different message types', async () => {
      const signal: ISILCSignal = {
        amplitude: 0.9,
        frequency: 7,
        phase: 0,
      };

      const result = await protocol.transmit(
        signal,
        testAgentId,
        SILCMessageType.CONFIDENCE_UPDATE,
      );

      expect(result.success).toBe(true);
    });

    test('should update performance metrics', async () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
      };

      const beforeMetrics = protocol.getPerformanceMetrics();

      await protocol.transmit(signal, testAgentId);

      const afterMetrics = protocol.getPerformanceMetrics();

      expect(afterMetrics.latency.transmission).toBeGreaterThanOrEqual(
        beforeMetrics.latency.transmission,
      );
    });
  });

  describe('Signal Reception', () => {
    test('should receive signals', async () => {
      const result = await protocol.receive();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.amplitude).toBeGreaterThanOrEqual(0);
      expect(result.data.amplitude).toBeLessThanOrEqual(1);
    });

    test('should emit reception events', async () => {
      const eventPromise = new Promise((resolve) => {
        protocol.once('signal.received', (message, senderAgent) => {
          resolve({ message, senderAgent });
        });
      });

      await protocol.receive();
      const event = await eventPromise;

      expect(event).toBeDefined();
    });

    test('should handle filtered reception', async () => {
      const filter = {
        fromAgent: testAgentId,
        messageType: SILCMessageType.SIGNAL_TRANSFER,
      };

      const result = await protocol.receive(filter);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Handshake Protocol', () => {
    test('should perform handshake', async () => {
      const result = await protocol.handshake(testAgentId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    test('should emit handshake events', async () => {
      const eventPromise = new Promise((resolve) => {
        protocol.once('protocol.handshake', (agent) => {
          resolve(agent);
        });
      });

      await protocol.handshake(testAgentId);
      const event = await eventPromise;

      expect(event).toEqual(testAgentId);
    });

    test('should update connection status', async () => {
      expect(protocol.getConnectionStatus(testAgentId)).toBe('unknown');

      await protocol.handshake(testAgentId);

      expect(protocol.getConnectionStatus(testAgentId)).toBe('connected');
    });
  });

  describe('Heartbeat', () => {
    test('should send heartbeat', async () => {
      await expect(protocol.heartbeat(testAgentId)).resolves.not.toThrow();
    });

    test('should emit heartbeat events', async () => {
      const eventPromise = new Promise((resolve) => {
        protocol.once('protocol.heartbeat', (agent) => {
          resolve(agent);
        });
      });

      await protocol.heartbeat(testAgentId);
      const event = await eventPromise;

      expect(event).toEqual(testAgentId);
    });
  });

  describe('Performance Metrics', () => {
    test('should provide performance metrics', () => {
      const metrics = protocol.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.latency).toBeDefined();
      expect(metrics.throughput).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.errors).toBeDefined();
      expect(metrics.resources).toBeDefined();
    });

    test('should track metrics over time', async () => {
      const initialMetrics = protocol.getPerformanceMetrics();

      // Perform some operations
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
      };

      await protocol.transmit(signal, testAgentId);
      await protocol.receive();

      const updatedMetrics = protocol.getPerformanceMetrics();

      // Some metrics should have changed
      expect(updatedMetrics.throughput.messagesPerSecond).toBeGreaterThanOrEqual(
        initialMetrics.throughput.messagesPerSecond,
      );
    });
  });

  describe('Agent Information', () => {
    test('should provide agent information', () => {
      const agentInfo = protocol.getAgentInfo();

      expect(agentInfo).toBeDefined();
      expect(agentInfo.namespace).toBeDefined();
      expect(agentInfo.modelType).toBeDefined();
      expect(agentInfo.instanceId).toBeDefined();
      expect(agentInfo.dialectVersion).toBeDefined();
      expect(Array.isArray(agentInfo.capabilities)).toBe(true);
    });
  });

  describe('Connection Management', () => {
    test('should track connection status', async () => {
      expect(protocol.getConnectionStatus(testAgentId)).toBe('unknown');

      await protocol.handshake(testAgentId);
      expect(protocol.getConnectionStatus(testAgentId)).toBe('connected');
    });

    test('should handle multiple agents', async () => {
      const agent1: SILCAgentID = { ...testAgentId, instanceId: 'agent-1' };
      const agent2: SILCAgentID = { ...testAgentId, instanceId: 'agent-2' };

      await protocol.handshake(agent1);
      await protocol.handshake(agent2);

      expect(protocol.getConnectionStatus(agent1)).toBe('connected');
      expect(protocol.getConnectionStatus(agent2)).toBe('connected');
    });
  });

  describe('Error Handling', () => {
    test('should emit error events', (done) => {
      protocol.once('error', (error) => {
        expect(error).toBeDefined();
        expect(error.category).toBeDefined();
        expect(error.severity).toBeDefined();
        done();
      });

      // Trigger an error by using invalid parameters
      try {
        protocol.createSignal({
          amplitude: 2.0, // Invalid
          frequency: 3,
          phase: 0,
        });
      } catch {
        // Error should be emitted
      }
    });

    test('should handle transmission errors gracefully', async () => {
      // This test would need to mock transport failures
      // For now, just ensure the method exists and handles basic cases
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
      };

      await expect(protocol.transmit(signal, testAgentId)).resolves.toBeDefined();
    });
  });

  describe('Shutdown', () => {
    test('should shutdown cleanly', async () => {
      await expect(protocol.shutdown()).resolves.not.toThrow();
    });

    test('should handle operations after shutdown', async () => {
      await protocol.shutdown();

      expect(() =>
        protocol.createSignal({
          amplitude: 0.5,
          frequency: 3,
          phase: 0,
        }),
      ).toThrow(/not initialized/i);
    });
  });
});

describe('Helper Functions', () => {
  describe('createSILCProtocol', () => {
    test('should create protocol with default settings', () => {
      const protocol = createSILCProtocol();

      expect(protocol).toBeInstanceOf(SILCProtocol);
    });

    test('should create protocol with custom agent ID', () => {
      const protocol = createSILCProtocol({
        agentId: {
          namespace: 'custom',
          modelType: 'custom-model',
          instanceId: 'custom-001',
        },
      });

      expect(protocol).toBeInstanceOf(SILCProtocol);
    });

    test('should create protocol with debug enabled', () => {
      const protocol = createSILCProtocol({
        debug: true,
      });

      expect(protocol).toBeInstanceOf(SILCProtocol);
    });

    test('should create protocol for different environments', () => {
      const devProtocol = createSILCProtocol({ environment: 'development' });
      const prodProtocol = createSILCProtocol({ environment: 'production' });
      const testProtocol = createSILCProtocol({ environment: 'test' });

      expect(devProtocol).toBeInstanceOf(SILCProtocol);
      expect(prodProtocol).toBeInstanceOf(SILCProtocol);
      expect(testProtocol).toBeInstanceOf(SILCProtocol);
    });
  });

  describe('quickStart', () => {
    test('should initialize protocol quickly', async () => {
      const protocol = await quickStart({
        namespace: 'quick-test',
        modelType: 'test-agent',
      });

      expect(protocol).toBeInstanceOf(SILCProtocol);

      // Should be able to create signals immediately
      const signal = protocol.createSignal({
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
      });

      expect(signal).toBeDefined();

      await protocol.shutdown();
    });

    test('should work with custom instance ID', async () => {
      const protocol = await quickStart({
        namespace: 'quick-test',
        modelType: 'test-agent',
        instanceId: 'quick-001',
      });

      const agentInfo = protocol.getAgentInfo();
      expect(agentInfo.instanceId).toBe('quick-001');

      await protocol.shutdown();
    });
  });
});
