/**
 * Base Fallback Handler Tests
 */

import { BaseFallbackHandler, FallbackReason } from '../../src/dialect/base-fallback';
import type { ISILCMessage, ISILCSignal, SILCAgentID } from '../../src/types/message.types';
import { SILCMessageType } from '../../src/types/message.types';

describe('BaseFallbackHandler', () => {
  let handler: BaseFallbackHandler;

  beforeEach(() => {
    handler = new BaseFallbackHandler();
  });

  const createTestAgent = (
    namespace: string,
    modelType: string,
    instanceId: string
  ): SILCAgentID => ({
    namespace,
    modelType,
    instanceId,
    metadata: { instanceId }
  });

  const createTestMessage = (signals: ISILCSignal[]): ISILCMessage => ({
    header: {
      version: '1.0.0',
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      messageType: SILCMessageType.SIGNAL_TRANSFER,
      senderId: createTestAgent('test', 'test-model', 'sender'),
      receiverId: createTestAgent('test', 'test-model', 'receiver'),
      priority: 0.5,
      ttl: 60000
    },
    signals,
    checksum: 'test'
  });

  describe('Base Specification Validation', () => {
    it('should validate correct base spec signals', () => {
      const signal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 3,
        phase: 0,
        harmonics: [0.618, 0.382]
      };

      const result = handler.validateBaseSpec(signal);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid amplitude', () => {
      const signal: ISILCSignal = {
        amplitude: 1.5, // Out of range
        frequency: 3,
        phase: 0
      };

      const result = handler.validateBaseSpec(signal);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Amplitude 1.5 out of range');
    });

    it('should reject invalid frequency', () => {
      const signal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 8, // Out of range
        phase: 0
      };

      const result = handler.validateBaseSpec(signal);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Frequency 8 out of range');
    });

    it('should reject invalid phase', () => {
      const signal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 3,
        phase: Math.PI / 2 // Not 0 or π
      };

      const result = handler.validateBaseSpec(signal);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Phase');
    });

    it('should validate harmonic constraints', () => {
      const signal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 3,
        phase: 0,
        harmonics: [0.618, 0.382, 0.5, 0.333, 0.667, 0.25] // Too many
      };

      const result = handler.validateBaseSpec(signal);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Too many harmonics');
    });

    it('should reject invalid harmonic values', () => {
      const signal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 3,
        phase: 0,
        harmonics: [0.618, 0.123] // 0.123 is not valid
      };

      const result = handler.validateBaseSpec(signal);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid harmonic value: 0.123');
    });
  });

  describe('Signal Normalization', () => {
    it('should normalize out-of-range values', () => {
      const message = createTestMessage([
        {
          amplitude: 1.5,  // Too high
          frequency: 10,   // Too high
          phase: Math.PI / 4, // Not allowed
          harmonics: [0.7, 0.3, 0.4, 0.5, 0.6, 0.7] // Too many + invalid
        }
      ]);

      const normalized = handler.convertToBase(message);
      const signal = normalized.signals[0];

      expect(signal.amplitude).toBe(1.0); // Clamped
      expect(signal.frequency).toBe(7); // Clamped
      expect(signal.phase).toBe(0); // Snapped to nearest
      expect(signal.harmonics).toHaveLength(5); // Limited
      expect(signal.harmonics![0]).toBeCloseTo(0.667); // Nearest valid
    });

    it('should preserve valid values', () => {
      const validSignal: ISILCSignal = {
        amplitude: 0.618,
        frequency: 5,
        phase: Math.PI,
        harmonics: [0.382, 0.5]
      };

      const message = createTestMessage([validSignal]);
      const normalized = handler.convertToBase(message);
      const signal = normalized.signals[0];

      expect(signal.amplitude).toBe(0.618);
      expect(signal.frequency).toBe(5);
      expect(signal.phase).toBe(Math.PI);
      expect(signal.harmonics).toEqual([0.382, 0.5]);
    });

    it('should add fallback metadata', () => {
      const message = createTestMessage([{ amplitude: 0.8, frequency: 3, phase: 0 }]);
      const converted = handler.convertToBase(message);

      expect(converted.metadata?.fallback).toBe(true);
      expect(converted.metadata?.originalFormat).toBe('dialect');
    });
  });

  describe('Cross-Boundary Detection', () => {
    it('should require fallback for different namespaces', () => {
      const sender = createTestAgent('namespace-a', 'model', 'sender');
      const receiver = createTestAgent('namespace-b', 'model', 'receiver');

      const requiresFallback = handler.requiresFallback(sender, receiver, 'instance-1');
      expect(requiresFallback).toBe(true);
    });

    it('should require fallback for different instances', () => {
      const sender = createTestAgent('test', 'model', 'sender');
      sender.metadata = { instanceId: 'instance-1' };
      
      const receiver = createTestAgent('test', 'model', 'receiver');
      receiver.metadata = { instanceId: 'instance-2' };

      const requiresFallback = handler.requiresFallback(sender, receiver, 'instance-1');
      expect(requiresFallback).toBe(true);
    });

    it('should allow same model family without fallback', () => {
      const sender = createTestAgent('test', 'gpt-4', 'sender');
      sender.metadata = { instanceId: 'instance-1' };
      
      const receiver = createTestAgent('test', 'gpt-3.5-turbo', 'receiver');
      receiver.metadata = { instanceId: 'instance-1' };

      const requiresFallback = handler.requiresFallback(sender, receiver, 'instance-1');
      expect(requiresFallback).toBe(false); // Same family (gpt) and same instance
    });

    it('should require fallback for different model families', () => {
      const sender = createTestAgent('test', 'gpt-4', 'sender');
      const receiver = createTestAgent('test', 'claude-3', 'receiver');

      const requiresFallback = handler.requiresFallback(sender, receiver, 'instance-1');
      expect(requiresFallback).toBe(true); // Different families
    });

    it('should not require fallback within same boundary', () => {
      const sender = createTestAgent('test', 'model-a', 'sender');
      sender.metadata = { instanceId: 'instance-1' };
      
      const receiver = createTestAgent('test', 'model-a', 'receiver');
      receiver.metadata = { instanceId: 'instance-1' };

      const requiresFallback = handler.requiresFallback(sender, receiver, 'instance-1');
      expect(requiresFallback).toBe(false);
    });
  });

  describe('Model Family Detection', () => {
    it('should detect GPT family', () => {
      const families = ['gpt-3', 'gpt-4', 'gpt-3.5-turbo'];
      families.forEach(model => {
        const family = handler['getModelFamily'](model);
        expect(family).toBe('gpt');
      });
    });

    it('should detect Claude family', () => {
      const families = ['claude', 'claude-2', 'claude-3-opus'];
      families.forEach(model => {
        const family = handler['getModelFamily'](model);
        expect(family).toBe('claude');
      });
    });

    it('should detect Llama family', () => {
      const families = ['llama', 'llama-2-70b', 'llama-3'];
      families.forEach(model => {
        const family = handler['getModelFamily'](model);
        expect(family).toBe('llama');
      });
    });

    it('should return original for unknown models', () => {
      const unknown = 'custom-model-xyz';
      const family = handler['getModelFamily'](unknown);
      expect(family).toBe(unknown);
    });
  });

  describe('Fallback Response Creation', () => {
    it('should create fallback response with reason', () => {
      const message = createTestMessage([
        { amplitude: 0.8, frequency: 3, phase: 0 }
      ]);

      const fallback = handler.createFallbackResponse(message, FallbackReason.CROSS_BOUNDARY);
      
      expect(fallback.metadata?.fallback).toBe(true);
      expect(fallback.metadata?.fallbackReason).toBe(FallbackReason.CROSS_BOUNDARY);
      expect(fallback.metadata?.timestamp).toBeDefined();
    });

    it('should normalize signals in fallback', () => {
      const message = createTestMessage([
        { amplitude: 2.0, frequency: 15, phase: 2 } // All invalid
      ]);

      const fallback = handler.createFallbackResponse(message, FallbackReason.VALIDATION_ERROR);
      const signal = fallback.signals[0];
      
      expect(signal.amplitude).toBe(1.0);
      expect(signal.frequency).toBe(7);
      expect(signal.phase).toBe(Math.PI);
    });
  });

  describe('Harmonic Normalization', () => {
    it('should find nearest valid harmonic', () => {
      const testCases = [
        { input: 0.6, expected: 0.618 },
        { input: 0.4, expected: 0.382 },
        { input: 0.55, expected: 0.5 },
        { input: 0.3, expected: 0.333 },
        { input: 0.7, expected: 0.667 }
      ];

      testCases.forEach(({ input, expected }) => {
        const nearest = handler['nearestValidHarmonic'](input);
        expect(nearest).toBe(expected);
      });
    });

    it('should handle edge cases in phase normalization', () => {
      const testCases = [
        { input: 0, expected: 0 },
        { input: Math.PI, expected: Math.PI },
        { input: Math.PI / 4, expected: 0 },
        { input: 3 * Math.PI / 4, expected: Math.PI },
        { input: -Math.PI / 4, expected: 0 },
        { input: -3 * Math.PI / 4, expected: Math.PI }
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = handler['normalizePhase'](input);
        expect(normalized).toBe(expected);
      });
    });
  });
});