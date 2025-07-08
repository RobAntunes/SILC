/**
 * Unit tests for SILC Signal Encoder
 */

import { SignalEncoder, MathConstants } from './encoder';
import type { ISILCSignal } from '@types/signal.types';

describe('SignalEncoder', () => {
  let encoder: SignalEncoder;

  beforeEach(() => {
    encoder = new SignalEncoder();
  });

  describe('Base64 Encoding', () => {
    test('should encode simple signal to Base64', () => {
      const signal: ISILCSignal = {
        amplitude: 0.75,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(signal, 'base64');

      expect(encoded.signal).toEqual(signal);
      expect(encoded.encoded).toHaveLength(1); // Single character for simple signal
      expect(encoded.encoding.method).toBe('base64');
      expect(encoded.checksum).toHaveLength(8);
    });

    test('should encode signal with harmonics', () => {
      const signal: ISILCSignal = {
        amplitude: 0.618,
        frequency: 1,
        phase: 0,
        harmonics: [1.618, 0.382]
      };

      const encoded = encoder.encode(signal, 'base64');

      expect(encoded.encoded.length).toBeGreaterThan(1); // Base char + harmonics
      expect(encoded.encoded).toMatch(/^[A-Za-z0-9+/]H/); // Should contain harmonic prefix
    });

    test('should handle all frequency bands', () => {
      for (let frequency = 0; frequency <= 7; frequency++) {
        const signal: ISILCSignal = {
          amplitude: 0.5,
          frequency,
          phase: 0
        };

        const encoded = encoder.encode(signal, 'base64');
        expect(encoded.encoded).toHaveLength(1);
        expect(encoded.encoding.method).toBe('base64');
      }
    });

    test('should handle both phase values', () => {
      const signalInPhase: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      const signalOutPhase: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: Math.PI
      };

      const encodedIn = encoder.encode(signalInPhase, 'base64');
      const encodedOut = encoder.encode(signalOutPhase, 'base64');

      expect(encodedIn.encoded).not.toBe(encodedOut.encoded);
    });
  });

  describe('IEEE754 Encoding', () => {
    test('should encode signal using IEEE754 format', () => {
      const signal: ISILCSignal = {
        amplitude: 0.12345,
        frequency: 2,
        phase: 1.5708, // π/2
        harmonics: [2.718, 1.414]
      };

      const encoded = encoder.encode(signal, 'ieee754');

      expect(encoded.encoding.method).toBe('ieee754');
      expect(encoded.encoded.length).toBeGreaterThan(20); // Base64 of binary data
    });
  });

  describe('Binary Encoding', () => {
    test('should encode signal in binary format', () => {
      const signal: ISILCSignal = {
        amplitude: 1.0,
        frequency: 7,
        phase: Math.PI
      };

      const encoded = encoder.encode(signal, 'binary');

      expect(encoded.encoding.method).toBe('binary');
      expect(encoded.encoded.length).toBeGreaterThan(0);
    });
  });

  describe('JSON Encoding', () => {
    test('should encode signal as JSON', () => {
      const signal: ISILCSignal = {
        amplitude: 0.75,
        frequency: 4,
        phase: 0,
        harmonics: [1, 2, 3]
      };

      const encoded = encoder.encode(signal, 'json');

      expect(encoded.encoding.method).toBe('json');
      expect(() => JSON.parse(encoded.encoded)).not.toThrow();
      
      const parsed = JSON.parse(encoded.encoded);
      expect(parsed).toEqual(signal);
    });
  });

  describe('Mathematical Constants', () => {
    test('should contain golden ratio constants', () => {
      expect(MathConstants.GOLDEN_RATIO.amplitude).toBeCloseTo(0.618, 3);
      expect(MathConstants.GOLDEN_RATIO.harmonics).toContain(1.618);
      expect(MathConstants.GOLDEN_RATIO.harmonics).toContain(0.382);
    });

    test('should contain mathematical constants', () => {
      expect(MathConstants.PI.frequency).toBe(3);
      expect(MathConstants.EULER.amplitude).toBeCloseTo(0.718, 3);
    });
  });

  describe('Signal Validation', () => {
    test('should reject invalid amplitude', () => {
      const signal: ISILCSignal = {
        amplitude: 1.5, // Invalid - greater than 1
        frequency: 3,
        phase: 0
      };

      expect(() => encoder.encode(signal)).toThrow(/amplitude/i);
    });

    test('should reject invalid frequency', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 8, // Invalid - greater than 7
        phase: 0
      };

      expect(() => encoder.encode(signal)).toThrow(/frequency/i);
    });

    test('should reject too many harmonics', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
        harmonics: new Array(101).fill(1) // Too many harmonics
      };

      expect(() => encoder.encode(signal)).toThrow(/harmonics/i);
    });

    test('should reject invalid harmonic values', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
        harmonics: [1, NaN, 3] // Invalid NaN value
      };

      expect(() => encoder.encode(signal)).toThrow(/harmonic/i);
    });
  });

  describe('Character Mapping', () => {
    test('should provide character mappings', () => {
      const mapping = SignalEncoder.getCharacterMapping('A');
      
      expect(mapping).toBeDefined();
      expect(mapping!.amplitude).toBe(0.25);
      expect(mapping!.frequency).toBe(0);
      expect(mapping!.phase).toBe(0);
    });

    test('should return all 64 characters', () => {
      const characters = SignalEncoder.getAllCharacters();
      
      expect(characters).toHaveLength(64);
      expect(characters).toContain('A');
      expect(characters).toContain('Z');
      expect(characters).toContain('a');
      expect(characters).toContain('z');
      expect(characters).toContain('0');
      expect(characters).toContain('9');
      expect(characters).toContain('+');
      expect(characters).toContain('/');
    });

    test('should have consistent mapping', () => {
      const characters = SignalEncoder.getAllCharacters();
      
      for (const char of characters) {
        const mapping = SignalEncoder.getCharacterMapping(char);
        expect(mapping).toBeDefined();
        expect(mapping!.amplitude).toBeGreaterThanOrEqual(0);
        expect(mapping!.amplitude).toBeLessThanOrEqual(1);
        expect(mapping!.frequency).toBeGreaterThanOrEqual(0);
        expect(mapping!.frequency).toBeLessThanOrEqual(7);
        expect([0, Math.PI]).toContain(mapping!.phase);
      }
    });
  });

  describe('Compression', () => {
    test.skip('should compress harmonics when beneficial', () => {
      const encoder = new SignalEncoder({ compressionLevel: 9 });
      
      // Create signal with large harmonics array
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
        harmonics: new Array(50).fill(0.1) // Repetitive data
      };

      const encoded = encoder.encode(signal, 'base64');
      
      // Should indicate compression was applied
      expect(encoded.encoding.compressionRatio).toBeGreaterThan(1);
    });

    test('should not compress small signals', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0,
        harmonics: [1, 2] // Small harmonics array
      };

      const encoded = encoder.encode(signal, 'base64');
      
      // Should not apply compression for small signals
      expect(encoded.encoding.compressionRatio).toBeLessThanOrEqual(1.1);
    });
  });

  describe('Error Handling', () => {
    test('should handle unsupported encoding format', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      expect(() => encoder.encode(signal, 'unsupported' as any)).toThrow(/unsupported/i);
    });
  });

  describe('Performance', () => {
    test('should encode signals quickly', () => {
      const signal: ISILCSignal = {
        amplitude: 0.75,
        frequency: 4,
        phase: 0,
        harmonics: [1.618, 0.618]
      };

      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        encoder.encode(signal, 'base64');
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should encode 1000 signals in under 100ms
    });
  });
});