/**
 * Dialect Manager Tests
 */

import { DialectManager } from '../../src/dialect/dialect-manager';
import type { ISILCMessage, ISILCSignal, SILCAgentID } from '../../src/types/message.types';
import { SILCMessageType } from '../../src/types/message.types';
import type { ActiveDialect, FallbackInfo } from '../../src/types/dialect.types';

describe('DialectManager', () => {
  let manager: DialectManager;
  const instanceId = 'test-instance-123';

  beforeEach(() => {
    manager = new DialectManager({
      instanceId,
      maxDialectsPerPair: 5,
      dialectTTL: 1000, // 1 second for testing
      enableDiscovery: true
    });
  });

  afterEach(() => {
    manager.shutdown();
  });

  const createTestAgent = (id: string, modelType: string = 'test-model'): SILCAgentID => ({
    namespace: 'test',
    modelType,
    instanceId: id
  });

  const createTestMessage = (
    senderId: string,
    receiverId: string,
    signals: ISILCSignal[] = [{ amplitude: 0.8, frequency: 3, phase: 0 }]
  ): ISILCMessage => ({
    header: {
      version: '1.0.0',
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      messageType: SILCMessageType.SIGNAL_TRANSFER,
      senderId: createTestAgent(senderId),
      receiverId: createTestAgent(receiverId),
      priority: 0.5,
      ttl: 60000
    },
    signals,
    checksum: 'test'
  });

  describe('Dialect Creation', () => {
    it('should create dialect for new agent pair', async () => {
      const createdDialects: ActiveDialect[] = [];
      manager.on('dialect.created', (dialect) => {
        createdDialects.push(dialect);
      });

      const message = createTestMessage('agent-1', 'agent-2');
      await manager.processMessage(message, 'sent');

      expect(createdDialects).toHaveLength(1);
      expect(createdDialects[0].scope.instanceId).toBe(instanceId);
      expect(createdDialects[0].scope.agentTypes).toContain('test-model');
    });

    it('should reuse dialect for same agent pair', async () => {
      const message1 = createTestMessage('agent-1', 'agent-2');
      const message2 = createTestMessage('agent-2', 'agent-1'); // Reverse direction

      await manager.processMessage(message1, 'sent');
      const dialects1 = manager['activeDialects'].size;

      await manager.processMessage(message2, 'received');
      const dialects2 = manager['activeDialects'].size;

      expect(dialects2).toBe(dialects1); // No new dialect created
    });

    it('should track dialect statistics', async () => {
      const message1 = createTestMessage('agent-1', 'agent-2');
      const message2 = createTestMessage('agent-1', 'agent-2');

      await manager.processMessage(message1, 'sent');
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await manager.processMessage(message2, 'sent');

      const dialectId = Array.from(manager['activeDialects'].keys())[0];
      const dialect = manager['activeDialects'].get(dialectId)!;

      expect(dialect.stats.messagesExchanged).toBe(2);
      expect(dialect.lastActivity).toBeGreaterThanOrEqual(dialect.created);
    });
  });

  describe('Pattern Management', () => {
    it('should add discovered patterns to relevant dialects', (done) => {
      manager.on('dialect.updated', (dialect) => {
        expect(dialect.patterns.size).toBeGreaterThan(0);
        done();
      });

      // Create dialect first
      const message = createTestMessage('agent-1', 'agent-2');
      manager.processMessage(message, 'sent').then(() => {
        // Simulate pattern discovery
        const discovery = manager['patternDiscovery'];
        discovery.emit('pattern.discovered', {
          id: 'test-pattern',
          signals: [{ amplitude: 0.8, frequency: 3, phase: 0 }],
          metadata: {
            occurrences: 5,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            contexts: {
              agentPairs: {
                'test/test-model -> test/test-model': 5
              }
            }
          },
          effectiveness: 0.85,
          adoptionRate: 2.5
        });
      });
    });

    it('should match message signals to dialect patterns', async () => {
      // Create dialect and add pattern
      const signals = [
        { amplitude: 0.8, frequency: 3, phase: 0 },
        { amplitude: 0.7, frequency: 4, phase: Math.PI }
      ];
      
      const message = createTestMessage('agent-1', 'agent-2', signals);
      await manager.processMessage(message, 'sent');

      // Add pattern to dialect
      const dialectId = Array.from(manager['activeDialects'].keys())[0];
      const dialect = manager['activeDialects'].get(dialectId)!;
      dialect.patterns.set('test-pattern', {
        id: 'test-pattern',
        signals,
        metadata: { occurrences: 5, firstSeen: Date.now(), lastSeen: Date.now(), contexts: {} },
        effectiveness: 0.9,
        adoptionRate: 3
      });

      // Process message with same pattern
      const message2 = createTestMessage('agent-1', 'agent-2', signals);
      await manager.processMessage(message2, 'sent');

      expect(dialect.stats.patternsUsed).toBeGreaterThan(0);
    });
  });

  describe('Fallback Handling', () => {
    it('should fallback for cross-boundary communication', (done) => {
      manager.on('fallback.used', (info: FallbackInfo) => {
        expect(info.reason).toBe('cross_boundary');
        expect(info.agents.sender.instanceId).toBe('external-1');
        done();
      });

      const message = createTestMessage('external-1', 'agent-2');
      message.header.senderId.namespace = 'external'; // Different namespace
      
      manager.fallbackToBase(message, 'cross_boundary');
    });

    it('should track fallback statistics', async () => {
      const message = createTestMessage('agent-1', 'agent-2');
      await manager.processMessage(message, 'sent');

      manager.fallbackToBase(message, 'unknown_pattern');
      manager.fallbackToBase(message, 'unknown_pattern');

      const dialectId = Array.from(manager['activeDialects'].keys())[0];
      const dialect = manager['activeDialects'].get(dialectId)!;
      
      expect(dialect.stats.fallbackCount).toBe(2);
    });

    it('should return message unchanged on fallback', () => {
      const message = createTestMessage('agent-1', 'agent-2');
      const fallbackMessage = manager.fallbackToBase(message, 'error');
      
      expect(fallbackMessage).toBe(message);
    });
  });

  describe('Dialect Boundaries', () => {
    it('should enforce instance boundaries', () => {
      const sender = createTestAgent('agent-1');
      const receiver = createTestAgent('agent-2');
      
      // Create dialect with different instance
      const dialect: ActiveDialect = {
        id: 'test-dialect',
        scope: {
          instanceId: 'different-instance',
          agentTypes: ['test-model'],
          expiresAt: Date.now() + 10000
        },
        patterns: new Map(),
        created: Date.now(),
        lastActivity: Date.now(),
        stats: {
          messagesExchanged: 0,
          patternsUsed: 0,
          fallbackCount: 0,
          compressionRatio: 0
        }
      };
      
      manager['activeDialects'].set('test-dialect', dialect);
      
      const canUse = manager.canUseDialect(sender, receiver, 'test-dialect');
      expect(canUse).toBe(false);
    });

    it('should check agent type compatibility', () => {
      const sender = createTestAgent('agent-1', 'model-a');
      const receiver = createTestAgent('agent-2', 'model-b');
      
      const dialect: ActiveDialect = {
        id: 'test-dialect',
        scope: {
          instanceId,
          agentTypes: ['model-a'], // Only model-a allowed
          expiresAt: Date.now() + 10000
        },
        patterns: new Map(),
        created: Date.now(),
        lastActivity: Date.now(),
        stats: {
          messagesExchanged: 0,
          patternsUsed: 0,
          fallbackCount: 0,
          compressionRatio: 0
        }
      };
      
      manager['activeDialects'].set('test-dialect', dialect);
      
      const canUse = manager.canUseDialect(sender, receiver, 'test-dialect');
      expect(canUse).toBe(false); // receiver is model-b, not allowed
    });
  });

  describe('Dialect Expiration', () => {
    it('should cleanup expired dialects', (done) => {
      // Create short-lived dialect
      manager = new DialectManager({
        instanceId,
        dialectTTL: 50 // 50ms
      });

      manager.on('dialect.expired', (dialectId) => {
        expect(dialectId).toContain('dialect-');
        done();
      });

      const message = createTestMessage('agent-1', 'agent-2');
      manager.processMessage(message, 'sent').then(() => {
        // Wait for expiration
        setTimeout(() => {
          manager['cleanupExpiredDialects']();
        }, 100);
      });
    });

    it('should remove expired dialects from active list', async () => {
      // Create dialect with short TTL
      manager = new DialectManager({
        instanceId,
        dialectTTL: 50
      });

      await manager.processMessage(createTestMessage('agent-1', 'agent-2'), 'sent');
      expect(manager['activeDialects'].size).toBe(1);

      // Wait for expiration and cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      manager['cleanupExpiredDialects']();
      
      expect(manager['activeDialects'].size).toBe(0);
    });
  });

  describe('Performance Tracking', () => {
    it('should calculate compression ratio', async () => {
      const pattern = [
        { amplitude: 0.8, frequency: 3, phase: 0 },
        { amplitude: 0.7, frequency: 4, phase: Math.PI }
      ];
      
      const message = createTestMessage('agent-1', 'agent-2', pattern);
      await manager.processMessage(message, 'sent');

      // Add pattern to dialect
      const dialectId = Array.from(manager['activeDialects'].keys())[0];
      const dialect = manager['activeDialects'].get(dialectId)!;
      dialect.patterns.set('test-pattern', {
        id: 'test-pattern',
        signals: pattern,
        metadata: { occurrences: 5, firstSeen: Date.now(), lastSeen: Date.now(), contexts: {} },
        effectiveness: 0.9,
        adoptionRate: 3
      });

      // Process message that matches pattern
      await manager.processMessage(message, 'sent');
      
      expect(dialect.stats.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages without signals', async () => {
      const message = createTestMessage('agent-1', 'agent-2', []);
      const processed = await manager.processMessage(message, 'sent');
      
      expect(processed).toBe(message);
    });

    it('should create unique dialect IDs', async () => {
      const messages = [
        createTestMessage('agent-1', 'agent-2'),
        createTestMessage('agent-3', 'agent-4'),
        createTestMessage('agent-5', 'agent-6')
      ];

      for (const msg of messages) {
        await manager.processMessage(msg, 'sent');
      }

      const dialectIds = Array.from(manager['activeDialects'].keys());
      const uniqueIds = new Set(dialectIds);
      
      expect(uniqueIds.size).toBe(dialectIds.length);
    });

    it('should handle shutdown gracefully', () => {
      expect(() => manager.shutdown()).not.toThrow();
      expect(manager['activeDialects'].size).toBe(0);
    });
  });
});