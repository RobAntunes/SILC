/**
 * SILC Signal Encoder
 *
 * Encodes SILC signals into Base64 representation using 6-bit encoding:
 * Bit Layout: [AA][FFF][P]
 * - AA (2 bits): Amplitude level (4 levels: 0.25, 0.5, 0.75, 1.0)
 * - FFF (3 bits): Frequency band (8 bands: 0-7)
 * - P (1 bit): Phase (0 = in-phase, 1 = out-of-phase)
 */

import type {
  CompressionInfo,
  EncodedSignal,
  HarmonicCoefficients,
  ISILCSignal,
  SignalEncodingFormat,
} from '../types/signal.types';
import { ErrorSeverity, SILCErrorCategory } from '../types/common.types';
import { SILCError } from '../core/errors';
import { createHash } from 'crypto';

/**
 * Base64 character set for SILC signal encoding
 */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Signal character mapping for Base64 encoding
 * Each character represents a complete signal state (6 bits)
 */
interface SignalCharacterMapping {
  amplitude: number;
  frequency: number;
  phase: number;
}

/**
 * Pre-computed Base64 signal character map
 */
const SIGNAL_CHARACTER_MAP = new Map<string, SignalCharacterMapping>();

/**
 * Reverse mapping from signal parameters to character
 */
const SIGNAL_TO_CHAR_MAP = new Map<string, string>();

/**
 * Initialize the signal character mappings
 */
function initializeSignalMaps(): void {
  for (let i = 0; i < 64; i++) {
    const char = BASE64_CHARS[i];

    // Extract components from 6-bit value
    const amplitudeBits = (i >> 4) & 0x03; // Upper 2 bits
    const frequencyBits = (i >> 1) & 0x07; // Middle 3 bits
    const phaseBit = i & 0x01; // Lower 1 bit

    // Map to actual values
    const amplitude = [0.25, 0.5, 0.75, 1.0][amplitudeBits];
    const frequency = frequencyBits;
    const phase = phaseBit === 0 ? 0 : Math.PI;

    const mapping: SignalCharacterMapping = { amplitude, frequency, phase };
    SIGNAL_CHARACTER_MAP.set(char, mapping);

    // Create reverse mapping key
    const key = `${amplitude}:${frequency}:${phase}`;
    SIGNAL_TO_CHAR_MAP.set(key, char);
  }
}

// Initialize maps on module load
initializeSignalMaps();

/**
 * Mathematical constants for special signal patterns
 */
export const MathConstants = {
  PI: {
    amplitude: 0.14159, // π decimals as amplitude
    frequency: 3, // π ≈ 3
    phase: 0,
    harmonics: [3.14159, 2.65358],
  },

  GOLDEN_RATIO: {
    amplitude: 0.618, // 1/φ
    frequency: 1, // φ ≈ 1.618 → band 1
    phase: 0,
    harmonics: [1.618, 0.382], // φ and φ-1
  },

  EULER: {
    amplitude: 0.718, // e - 2
    frequency: 2, // floor(e)
    phase: 0,
    harmonics: [2.718, 1.718], // e and e-1
  },
} as const;

/**
 * SILC Signal Encoder Class
 */
export class SignalEncoder {
  private compressionLevel: number;
  private enableHarmonics: boolean;

  constructor(
    options: {
      compressionLevel?: number;
      enableHarmonics?: boolean;
    } = {},
  ) {
    this.compressionLevel = options.compressionLevel ?? 6;
    this.enableHarmonics = options.enableHarmonics ?? true;
  }

  /**
   * Encode a SILC signal to Base64 representation
   */
  public encode(signal: ISILCSignal, format: SignalEncodingFormat = 'base64'): EncodedSignal {
    this.validateSignal(signal);

    switch (format) {
      case 'base64':
        return this.encodeBase64(signal);
      case 'ieee754':
        return this.encodeIEEE754(signal);
      case 'binary':
        return this.encodeBinary(signal);
      case 'json':
        return this.encodeJSON(signal);
      default:
        throw new SILCError(
          `Unsupported encoding format: ${format}`,
          SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
          ErrorSeverity.MEDIUM,
          500,
        );
    }
  }

  /**
   * Encode signal using Base64 character mapping
   */
  private encodeBase64(signal: ISILCSignal): EncodedSignal {
    // Quantize amplitude to 4 levels
    const amplitudeLevel = this.quantizeAmplitude(signal.amplitude);

    // Validate frequency band
    const frequency = Math.max(0, Math.min(7, Math.floor(signal.frequency)));

    // Convert phase to binary
    const phase = this.quantizePhase(signal.phase);

    // Create lookup key
    const key = `${amplitudeLevel}:${frequency}:${phase}`;
    const baseChar = SIGNAL_TO_CHAR_MAP.get(key);

    if (!baseChar) {
      throw new SILCError(
        `Failed to encode signal parameters: ${key}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.HIGH,
        201,
      );
    }

    let encoded = baseChar;
    let compressionInfo: CompressionInfo = {
      algorithm: 'none',
      level: 0,
      ratio: 1.0,
    };

    // Handle harmonics if present
    if (signal.harmonics && signal.harmonics.length > 0 && this.enableHarmonics) {
      const harmonicData = this.encodeHarmonics(signal.harmonics);
      encoded += harmonicData.encoded;
      compressionInfo = harmonicData.compression;
    }

    // Calculate checksum
    const checksum = createHash('sha256').update(encoded).digest('hex').substring(0, 8);

    // Return the quantized signal values for base64 encoding
    const quantizedSignal: ISILCSignal = {
      amplitude: amplitudeLevel,
      frequency: frequency,
      phase: phase,
      harmonics: signal.harmonics,
    };

    return {
      signal: quantizedSignal,
      encoded,
      encoding: {
        method: 'base64',
        compressionRatio: compressionInfo.ratio,
        size: encoded.length,
      },
      checksum,
    };
  }

  /**
   * Encode harmonics using compressed representation
   */
  private encodeHarmonics(harmonics: number[]): { encoded: string; compression: CompressionInfo } {
    // Convert harmonics to binary representation
    const buffer = new Float32Array(harmonics);
    const bytes = new Uint8Array(buffer.buffer);

    // Apply compression if beneficial
    let compressed = bytes;
    let compressionRatio = 1.0;

    if (bytes.length > 32 && this.compressionLevel > 0) {
      // Simple run-length encoding for demonstration
      compressed = this.compressBytes(bytes);
      compressionRatio = bytes.length / compressed.length;
    }

    // Convert to Base64
    const encoded = Buffer.from(compressed).toString('base64');

    return {
      encoded: `H${encoded}`, // Prefix with 'H' to indicate harmonics
      compression: {
        algorithm: compressionRatio > 1.1 ? 'custom' : 'none',
        level: this.compressionLevel,
        ratio: compressionRatio,
      },
    };
  }

  /**
   * Encode signal using IEEE754 representation
   */
  private encodeIEEE754(signal: ISILCSignal): EncodedSignal {
    const buffer = new ArrayBuffer(16 + (signal.harmonics?.length ?? 0) * 4);
    const view = new DataView(buffer);

    // Store signal components as IEEE754 floats
    view.setFloat32(0, signal.amplitude);
    view.setFloat32(4, signal.frequency);
    view.setFloat32(8, signal.phase);
    view.setUint32(12, signal.harmonics?.length ?? 0);

    // Store harmonics
    if (signal.harmonics) {
      signal.harmonics.forEach((harmonic, index) => {
        view.setFloat32(16 + index * 4, harmonic);
      });
    }

    const encoded = Buffer.from(buffer).toString('base64');
    const checksum = createHash('sha256').update(encoded).digest('hex').substring(0, 8);

    return {
      signal,
      encoded,
      encoding: {
        method: 'ieee754',
        size: encoded.length,
      },
      checksum,
    };
  }

  /**
   * Encode signal as binary data
   */
  private encodeBinary(signal: ISILCSignal): EncodedSignal {
    // Simple binary encoding for maximum efficiency
    const amplitude8 = Math.floor(signal.amplitude * 255);
    const frequency3 = signal.frequency & 0x07;
    const phase1 = signal.phase > Math.PI / 2 ? 1 : 0;

    // Pack into single byte: AAAAAAAF FFF0000P
    const byte1 = amplitude8 << 0;
    const byte2 = (frequency3 << 5) | (phase1 << 0);

    const buffer = new Uint8Array([byte1, byte2]);
    const encoded = Buffer.from(buffer).toString('base64');
    const checksum = createHash('sha256').update(encoded).digest('hex').substring(0, 8);

    return {
      signal,
      encoded,
      encoding: {
        method: 'binary',
        size: encoded.length,
      },
      checksum,
    };
  }

  /**
   * Encode signal as JSON (fallback format)
   */
  private encodeJSON(signal: ISILCSignal): EncodedSignal {
    const encoded = JSON.stringify(signal);
    const checksum = createHash('sha256').update(encoded).digest('hex').substring(0, 8);

    return {
      signal,
      encoded,
      encoding: {
        method: 'json',
        size: encoded.length,
      },
      checksum,
    };
  }

  /**
   * Quantize amplitude to 4 discrete levels
   */
  private quantizeAmplitude(amplitude: number): number {
    if (amplitude <= 0.375) return 0.25;
    if (amplitude <= 0.625) return 0.5;
    if (amplitude <= 0.875) return 0.75;
    return 1.0;
  }

  /**
   * Quantize phase to binary representation
   */
  private quantizePhase(phase: number): number {
    // Normalize phase to [0, 2π]
    const normalizedPhase = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Binary quantization: 0 for [0, π), π for [π, 2π)
    return normalizedPhase < Math.PI ? 0 : Math.PI;
  }

  /**
   * Simple byte compression using run-length encoding
   */
  private compressBytes(bytes: Uint8Array): Uint8Array {
    const compressed: number[] = [];
    let i = 0;

    while (i < bytes.length) {
      const currentByte = bytes[i];
      let count = 1;

      // Count consecutive identical bytes
      while (i + count < bytes.length && bytes[i + count] === currentByte && count < 255) {
        count++;
      }

      if (count > 3) {
        // Use run-length encoding for runs of 4 or more
        compressed.push(0xff, count, currentByte); // Escape sequence
      } else {
        // Store bytes literally
        for (let j = 0; j < count; j++) {
          compressed.push(currentByte);
        }
      }

      i += count;
    }

    return new Uint8Array(compressed);
  }

  /**
   * Validate signal parameters
   */
  private validateSignal(signal: ISILCSignal): void {
    if (signal.amplitude < 0 || signal.amplitude > 1) {
      throw new SILCError(
        `Invalid amplitude: ${signal.amplitude}. Must be between 0 and 1.`,
        SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
        ErrorSeverity.HIGH,
        200,
      );
    }

    if (signal.frequency < 0 || signal.frequency > 7 || !Number.isInteger(signal.frequency)) {
      throw new SILCError(
        `Invalid frequency: ${signal.frequency}. Must be integer between 0 and 7.`,
        SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
        ErrorSeverity.HIGH,
        200,
      );
    }

    if (signal.harmonics) {
      if (signal.harmonics.length > 100) {
        throw new SILCError(
          `Too many harmonics: ${signal.harmonics.length}. Maximum 100 allowed.`,
          SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
          ErrorSeverity.MEDIUM,
          200,
        );
      }

      for (const harmonic of signal.harmonics) {
        if (!Number.isFinite(harmonic)) {
          throw new SILCError(
            `Invalid harmonic value: ${harmonic}. Must be finite number.`,
            SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
            ErrorSeverity.HIGH,
            200,
          );
        }
      }
    }
  }

  /**
   * Get the character mapping for a given signal
   */
  public static getCharacterMapping(char: string): SignalCharacterMapping | undefined {
    return SIGNAL_CHARACTER_MAP.get(char);
  }

  /**
   * Get all available signal characters
   */
  public static getAllCharacters(): string[] {
    return Array.from(SIGNAL_CHARACTER_MAP.keys());
  }
}
