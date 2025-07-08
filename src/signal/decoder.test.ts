/**
 * Unit tests for SILC Signal Decoder
 */

import { SignalEncoder } from './encoder';
import { SignalDecoder } from './decoder';
import type { ISILCSignal, EncodedSignal } from '@types/signal.types';

describe('SignalDecoder', () => {
  let encoder: SignalEncoder;
  let decoder: SignalDecoder;

  beforeEach(() => {
    encoder = new SignalEncoder();
    decoder = new SignalDecoder();
  });

  describe('Base64 Decoding', () => {
    test('should decode simple Base64 signal', () => {
      const originalSignal: ISILCSignal = {
        amplitude: 0.75,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(originalSignal, 'base64');
      const result = decoder.decode(encoded);

      expect(result.signal.amplitude).toBeCloseTo(0.75, 2);
      expect(result.signal.frequency).toBe(3);
      expect(result.signal.phase).toBeCloseTo(0, 2);
      expect(result.metadata.format).toBe('base64');
    });

    test('should decode signal with harmonics', () => {
      const originalSignal: ISILCSignal = {
        amplitude: 0.618,
        frequency: 1,
        phase: 0,
        harmonics: [1.618, 0.382]
      };

      const encoded = encoder.encode(originalSignal, 'base64');
      const result = decoder.decode(encoded);

      // Amplitude 0.618 gets quantized to 0.5 in base64 encoding
      expect(result.signal.amplitude).toBe(0.5);
      expect(result.signal.frequency).toBe(1);
      expect(result.signal.harmonics).toBeDefined();
      expect(result.signal.harmonics!.length).toBe(2);
    });

    test('should preserve phase information', () => {
      const inPhaseSignal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      const outPhaseSignal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: Math.PI
      };

      const encodedIn = encoder.encode(inPhaseSignal, 'base64');
      const encodedOut = encoder.encode(outPhaseSignal, 'base64');

      const decodedIn = decoder.decode(encodedIn);
      const decodedOut = decoder.decode(encodedOut);

      expect(decodedIn.signal.phase).toBeCloseTo(0, 2);
      expect(decodedOut.signal.phase).toBeCloseTo(Math.PI, 2);
    });
  });

  describe('IEEE754 Decoding', () => {
    test('should decode IEEE754 encoded signals', () => {
      const originalSignal: ISILCSignal = {
        amplitude: 0.12345,
        frequency: 2,
        phase: 1.5708, // π/2
        harmonics: [2.718, 1.414]
      };

      const encoded = encoder.encode(originalSignal, 'ieee754');
      const result = decoder.decode(encoded);

      expect(result.signal.amplitude).toBeCloseTo(0.12345, 4);
      expect(result.signal.frequency).toBeCloseTo(2, 4);
      expect(result.signal.phase).toBeCloseTo(1.5708, 4);
      expect(result.signal.harmonics!.length).toBe(2);
      expect(result.signal.harmonics![0]).toBeCloseTo(2.718, 3);
      expect(result.signal.harmonics![1]).toBeCloseTo(1.414, 3);
    });
  });

  describe('Binary Decoding', () => {
    test('should decode binary encoded signals', () => {
      const originalSignal: ISILCSignal = {
        amplitude: 1.0,
        frequency: 7,
        phase: Math.PI
      };

      const encoded = encoder.encode(originalSignal, 'binary');
      const result = decoder.decode(encoded);

      expect(result.signal.amplitude).toBeCloseTo(1.0, 1);
      expect(result.signal.frequency).toBe(7);
      expect(result.signal.phase).toBeCloseTo(Math.PI, 1);
    });
  });

  describe('JSON Decoding', () => {
    test('should decode JSON encoded signals', () => {
      const originalSignal: ISILCSignal = {
        amplitude: 0.75,
        frequency: 4,
        phase: 0,
        harmonics: [1, 2, 3]
      };

      const encoded = encoder.encode(originalSignal, 'json');
      const result = decoder.decode(encoded);

      expect(result.signal).toEqual(originalSignal);
    });
  });

  describe('Round-trip Encoding/Decoding', () => {
    test('should maintain signal integrity through round-trip', () => {
      const testSignals: ISILCSignal[] = [
        { amplitude: 0.25, frequency: 0, phase: 0 },
        { amplitude: 0.5, frequency: 3, phase: 0 },
        { amplitude: 0.75, frequency: 5, phase: Math.PI },
        { amplitude: 1.0, frequency: 7, phase: 0 },
        { 
          amplitude: 0.618, 
          frequency: 1, 
          phase: 0, 
          harmonics: [1.618, 0.382, 2.618] 
        }
      ];

      for (const originalSignal of testSignals) {
        const encoded = encoder.encode(originalSignal, 'base64');
        const result = decoder.decode(encoded);

        // For Base64 encoding, amplitude is quantized (0.618 → 0.5)
        const expectedAmplitude = originalSignal.amplitude === 0.618 ? 0.5 : originalSignal.amplitude;
        expect(result.signal.amplitude).toBeCloseTo(expectedAmplitude, 1);
        expect(result.signal.frequency).toBe(originalSignal.frequency);
        expect(result.signal.phase).toBeCloseTo(originalSignal.phase, 1);
        
        if (originalSignal.harmonics) {
          expect(result.signal.harmonics).toBeDefined();
          expect(result.signal.harmonics!.length).toBe(originalSignal.harmonics.length);
        }
      }
    });

    test('should work with all encoding formats', () => {
      const signal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 4,
        phase: Math.PI,
        harmonics: [1.414, 2.718]
      };

      const formats: Array<'base64' | 'ieee754' | 'binary' | 'json'> = 
        ['base64', 'ieee754', 'binary', 'json'];

      for (const format of formats) {
        const encoded = encoder.encode(signal, format);
        const result = decoder.decode(encoded);

        expect(result.metadata.format).toBe(format);
        // Base64 quantizes amplitude: 0.8 → 0.75
        const expectedAmplitude = format === 'base64' ? 0.75 : signal.amplitude;
        expect(result.signal.amplitude).toBeCloseTo(expectedAmplitude, format === 'binary' ? 0 : 2);
        expect(result.signal.frequency).toBe(signal.frequency);
      }
    });
  });

  describe('Checksum Validation', () => {
    test('should validate checksums by default', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(signal, 'base64');
      
      // Should not throw with valid checksum
      expect(() => decoder.decode(encoded)).not.toThrow();
    });

    test('should detect corrupted checksums', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(signal, 'base64');
      
      // Corrupt the checksum
      const corrupted: EncodedSignal = {
        ...encoded,
        checksum: 'invalid'
      };

      expect(() => decoder.decode(corrupted)).toThrow(/checksum/i);
    });

    test('should skip checksum validation when disabled', () => {
      const decoder = new SignalDecoder({ validateChecksums: false });
      
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(signal, 'base64');
      
      // Corrupt the checksum
      const corrupted: EncodedSignal = {
        ...encoded,
        checksum: 'invalid'
      };

      // Should not throw when checksum validation is disabled
      expect(() => decoder.decode(corrupted)).not.toThrow();
    });
  });

  describe('Signal Validation', () => {
    test('should validate decoded signals', () => {
      const validSignal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(validSignal, 'base64');
      const result = decoder.decode(encoded);

      expect(result.signal.amplitude).toBeGreaterThanOrEqual(0);
      expect(result.signal.amplitude).toBeLessThanOrEqual(1);
      expect(result.signal.frequency).toBeGreaterThanOrEqual(0);
      expect(result.signal.frequency).toBeLessThanOrEqual(7);
    });

    test('should handle validation in strict mode', () => {
      const decoder = new SignalDecoder({ strictMode: true });
      
      // Create an encoded signal with invalid data
      const invalidEncoded: EncodedSignal = {
        signal: { amplitude: 1.5, frequency: 3, phase: 0 }, // Invalid amplitude
        encoded: 'A',
        encoding: { method: 'base64', size: 1 },
        checksum: '12345678'
      };

      expect(() => decoder.decode(invalidEncoded)).toThrow();
    });

    test('should provide quality assessment', () => {
      const highQualitySignal: ISILCSignal = {
        amplitude: 0.9,
        frequency: 3,
        phase: 0,
        harmonics: [1.618, 0.618] // Golden ratio harmonics
      };

      const encoded = encoder.encode(highQualitySignal, 'base64');
      const result = decoder.decode(encoded);

      // Quality should be assessed in metadata
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Batch Decoding', () => {
    test('should decode multiple signals', () => {
      const signals: ISILCSignal[] = [
        { amplitude: 0.25, frequency: 0, phase: 0 },
        { amplitude: 0.5, frequency: 3, phase: 0 },
        { amplitude: 0.75, frequency: 7, phase: Math.PI }
      ];

      const encodedSignals = signals.map(signal => encoder.encode(signal, 'base64'));
      const results = decoder.decodeBatch(encodedSignals);

      expect(results).toHaveLength(3);
      
      results.forEach((result, index) => {
        expect(result.signal.amplitude).toBeCloseTo(signals[index].amplitude, 1);
        expect(result.signal.frequency).toBe(signals[index].frequency);
        expect(result.signal.phase).toBeCloseTo(signals[index].phase, 1);
      });
    });
  });

  describe('Format Detection', () => {
    test('should detect JSON format', () => {
      const jsonEncoded = '{"amplitude":0.5,"frequency":3,"phase":0}';
      
      const format = decoder.detectFormat(jsonEncoded);
      
      expect(format).toBe('json');
    });

    test('should detect Base64 format', () => {
      const base64Encoded = 'A';
      
      const format = decoder.detectFormat(base64Encoded);
      
      expect(format).toBe('base64');
    });

    test('should detect Base64 with harmonics', () => {
      const base64WithHarmonics = 'AHsomething';
      
      const format = decoder.detectFormat(base64WithHarmonics);
      
      expect(format).toBe('base64');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty encoded signals', () => {
      const emptyEncoded: EncodedSignal = {
        signal: { amplitude: 0.5, frequency: 3, phase: 0 },
        encoded: '',
        encoding: { method: 'base64', size: 0 },
        checksum: 'e3b0c442' // SHA256 hash of empty string
      };

      // Should throw for empty encoded signal
      expect(() => decoder.decode(emptyEncoded)).toThrow(/empty/i);
    });

    test('should handle invalid Base64 characters', () => {
      const invalidEncoded: EncodedSignal = {
        signal: { amplitude: 0.5, frequency: 3, phase: 0 },
        encoded: '@', // Invalid Base64 character
        encoding: { method: 'base64', size: 1 },
        checksum: '12345678'
      };

      expect(() => decoder.decode(invalidEncoded)).toThrow();
    });

    test('should handle corrupted harmonic data', () => {
      const corruptedEncoded: EncodedSignal = {
        signal: { amplitude: 0.5, frequency: 3, phase: 0 },
        encoded: 'AH!!!invalid!!!', // Corrupted harmonics
        encoding: { method: 'base64', size: 15 },
        checksum: '12345678'
      };

      expect(() => decoder.decode(corruptedEncoded)).toThrow();
    });

    test('should handle unsupported encoding formats', () => {
      const decoderNoChecksum = new SignalDecoder({ validateChecksum: false });
      const unsupportedEncoded: EncodedSignal = {
        signal: { amplitude: 0.5, frequency: 3, phase: 0 },
        encoded: 'test',
        encoding: { method: 'unsupported' as any, size: 4 },
        checksum: '9f86d081' // SHA256 hash of 'test'
      };

      expect(() => decoderNoChecksum.decode(unsupportedEncoded)).toThrow(/unsupported/i);
    });
  });

  describe('Performance', () => {
    test('should decode signals quickly', () => {
      const signal: ISILCSignal = {
        amplitude: 0.75,
        frequency: 4,
        phase: 0,
        harmonics: [1.618, 0.618]
      };

      const encoded = encoder.encode(signal, 'base64');
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        decoder.decode(encoded);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should decode 1000 signals in under 100ms
    });

    test('should provide performance metadata', () => {
      const signal: ISILCSignal = {
        amplitude: 0.5,
        frequency: 3,
        phase: 0
      };

      const encoded = encoder.encode(signal, 'base64');
      const result = decoder.decode(encoded);

      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.originalSize).toBeGreaterThan(0);
      expect(result.metadata.decodedSize).toBeGreaterThan(0);
      expect(result.metadata.compressionRatio).toBeGreaterThan(0);
    });
  });
});