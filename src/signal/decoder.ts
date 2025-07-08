/**
 * SILC Signal Decoder
 * 
 * Decodes SILC signals from various encoded formats back to ISILCSignal objects.
 * Handles Base64, IEEE754, binary, and JSON representations with validation.
 */

import type { 
  ISILCSignal, 
  EncodedSignal, 
  SignalEncodingFormat,
  SignalValidationResult 
} from '../types/signal.types';
import { SILCErrorCategory, ErrorSeverity } from '../types/common.types';
import { SILCError } from '../core/errors';
import { SignalEncoder } from './encoder';
import { createHash } from 'crypto';

/**
 * Decoding result with metadata
 */
interface DecodingResult {
  signal: ISILCSignal;
  metadata: {
    format: SignalEncodingFormat;
    originalSize: number;
    decodedSize: number;
    compressionRatio: number;
    processingTime: number;
  };
}

/**
 * SILC Signal Decoder Class
 */
export class SignalDecoder {
  private validateChecksums: boolean;
  private strictMode: boolean;

  constructor(options: {
    validateChecksums?: boolean;
    strictMode?: boolean;
  } = {}) {
    this.validateChecksums = options.validateChecksums ?? true;
    this.strictMode = options.strictMode ?? false;
  }

  /**
   * Decode an encoded SILC signal
   */
  public decode(encodedSignal: EncodedSignal): DecodingResult {
    const startTime = performance.now();

    // Validate checksum if enabled
    if (this.validateChecksums) {
      this.verifyChecksum(encodedSignal);
    }

    let signal: ISILCSignal;
    const format = encodedSignal.encoding.method as SignalEncodingFormat;

    switch (format) {
      case 'base64':
        signal = this.decodeBase64(encodedSignal.encoded);
        break;
      case 'ieee754':
        signal = this.decodeIEEE754(encodedSignal.encoded);
        break;
      case 'binary':
        signal = this.decodeBinary(encodedSignal.encoded);
        break;
      case 'json':
        signal = this.decodeJSON(encodedSignal.encoded);
        break;
      default:
        throw new SILCError(
          `Unsupported decoding format: ${format}`,
          SILCErrorCategory.INVALID_MESSAGE_FORMAT,
          ErrorSeverity.HIGH,
          101
        );
    }

    // Validate decoded signal
    const validationResult = this.validateSignal(signal);
    if (!validationResult.valid && this.strictMode) {
      throw new SILCError(
        `Signal validation failed: ${validationResult.errors.join(', ')}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.HIGH,
        201
      );
    }

    const endTime = performance.now();

    return {
      signal,
      metadata: {
        format,
        originalSize: encodedSignal.encoded.length,
        decodedSize: this.calculateSignalSize(signal),
        compressionRatio: encodedSignal.encoding.compressionRatio ?? 1.0,
        processingTime: endTime - startTime
      }
    };
  }

  /**
   * Decode from Base64 character representation
   */
  private decodeBase64(encoded: string): ISILCSignal {
    if (encoded.length === 0) {
      throw new SILCError(
        'Empty encoded signal',
        SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
        ErrorSeverity.HIGH,
        200
      );
    }

    // Extract base signal character
    const baseChar = encoded[0];
    const mapping = SignalEncoder.getCharacterMapping(baseChar);
    
    if (!mapping) {
      throw new SILCError(
        `Invalid signal character: ${baseChar}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.HIGH,
        201
      );
    }

    const signal: ISILCSignal = {
      amplitude: mapping.amplitude,
      frequency: mapping.frequency,
      phase: mapping.phase
    };

    // Check for harmonics data
    if (encoded.length > 1) {
      const harmonicsData = encoded.substring(1);
      if (harmonicsData.startsWith('H')) {
        // Decode harmonics
        signal.harmonics = this.decodeHarmonics(harmonicsData.substring(1));
      }
    }

    return signal;
  }

  /**
   * Decode harmonics from compressed Base64 representation
   */
  private decodeHarmonics(harmonicsEncoded: string): number[] {
    try {
      // Decode from Base64
      const compressed = Buffer.from(harmonicsEncoded, 'base64');
      
      // Decompress if needed
      const decompressed = this.decompressBytes(compressed);
      
      // Convert back to Float32Array
      const buffer = decompressed.buffer.slice(
        decompressed.byteOffset, 
        decompressed.byteOffset + decompressed.byteLength
      );
      const harmonicsArray = new Float32Array(buffer);
      
      return Array.from(harmonicsArray);
    } catch (error) {
      throw new SILCError(
        `Failed to decode harmonics: ${error instanceof Error ? error.message : String(error)}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.MEDIUM,
        201
      );
    }
  }

  /**
   * Decode from IEEE754 representation
   */
  private decodeIEEE754(encoded: string): ISILCSignal {
    try {
      const buffer = Buffer.from(encoded, 'base64');
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      
      const amplitude = view.getFloat32(0);
      const frequency = view.getFloat32(4);
      const phase = view.getFloat32(8);
      const harmonicsCount = view.getUint32(12);
      
      const signal: ISILCSignal = { amplitude, frequency, phase };
      
      if (harmonicsCount > 0) {
        const harmonics: number[] = [];
        for (let i = 0; i < harmonicsCount; i++) {
          harmonics.push(view.getFloat32(16 + i * 4));
        }
        signal.harmonics = harmonics;
      }
      
      return signal;
    } catch (error) {
      throw new SILCError(
        `Failed to decode IEEE754 signal: ${error instanceof Error ? error.message : String(error)}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.HIGH,
        201
      );
    }
  }

  /**
   * Decode from binary representation
   */
  private decodeBinary(encoded: string): ISILCSignal {
    try {
      const buffer = Buffer.from(encoded, 'base64');
      
      if (buffer.length < 2) {
        throw new Error('Insufficient binary data');
      }
      
      const byte1 = buffer[0];
      const byte2 = buffer[1];
      
      // Extract components
      const amplitude = byte1 / 255;
      const frequency = (byte2 >> 5) & 0x07;
      const phase = (byte2 & 0x01) === 1 ? Math.PI : 0;
      
      return { amplitude, frequency, phase };
    } catch (error) {
      throw new SILCError(
        `Failed to decode binary signal: ${error instanceof Error ? error.message : String(error)}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.HIGH,
        201
      );
    }
  }

  /**
   * Decode from JSON representation
   */
  private decodeJSON(encoded: string): ISILCSignal {
    try {
      const signal = JSON.parse(encoded) as ISILCSignal;
      
      // Validate structure
      if (typeof signal.amplitude !== 'number' ||
          typeof signal.frequency !== 'number' ||
          typeof signal.phase !== 'number') {
        throw new Error('Invalid signal structure in JSON');
      }
      
      return signal;
    } catch (error) {
      throw new SILCError(
        `Failed to decode JSON signal: ${error instanceof Error ? error.message : String(error)}`,
        SILCErrorCategory.INVALID_MESSAGE_FORMAT,
        ErrorSeverity.HIGH,
        101
      );
    }
  }

  /**
   * Decompress bytes using reverse run-length encoding
   */
  private decompressBytes(compressed: Uint8Array): Uint8Array {
    const decompressed: number[] = [];
    let i = 0;
    
    while (i < compressed.length) {
      if (compressed[i] === 0xFF && i + 2 < compressed.length) {
        // Run-length encoded sequence
        const count = compressed[i + 1];
        const value = compressed[i + 2];
        
        for (let j = 0; j < count; j++) {
          decompressed.push(value);
        }
        
        i += 3;
      } else {
        // Literal byte
        decompressed.push(compressed[i]);
        i++;
      }
    }
    
    return new Uint8Array(decompressed);
  }

  /**
   * Verify checksum of encoded signal
   */
  private verifyChecksum(encodedSignal: EncodedSignal): void {
    const calculatedChecksum = createHash('sha256')
      .update(encodedSignal.encoded)
      .digest('hex')
      .substring(0, 8);
    
    if (calculatedChecksum !== encodedSignal.checksum) {
      throw new SILCError(
        `Checksum mismatch. Expected: ${encodedSignal.checksum}, Got: ${calculatedChecksum}`,
        SILCErrorCategory.SIGNAL_CORRUPTION,
        ErrorSeverity.CRITICAL,
        201
      );
    }
  }

  /**
   * Validate decoded signal parameters
   */
  private validateSignal(signal: ISILCSignal): SignalValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let quality = 1.0;

    // Validate amplitude
    if (signal.amplitude < 0 || signal.amplitude > 1) {
      errors.push(`Invalid amplitude: ${signal.amplitude} (must be 0-1)`);
      quality *= 0.5;
    } else if (signal.amplitude === 0) {
      warnings.push('Zero amplitude signal may indicate no confidence');
      quality *= 0.9;
    }

    // Validate frequency
    if (signal.frequency < 0 || signal.frequency > 7 || !Number.isInteger(signal.frequency)) {
      errors.push(`Invalid frequency: ${signal.frequency} (must be integer 0-7)`);
      quality *= 0.5;
    }

    // Validate phase
    if (!Number.isFinite(signal.phase)) {
      errors.push(`Invalid phase: ${signal.phase} (must be finite number)`);
      quality *= 0.5;
    } else {
      // Normalize phase and check if it's close to 0 or π
      const normalizedPhase = ((signal.phase % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
      const isValidPhase = Math.abs(normalizedPhase) < 0.1 || 
                          Math.abs(normalizedPhase - Math.PI) < 0.1 ||
                          Math.abs(normalizedPhase - 2 * Math.PI) < 0.1;
      
      if (!isValidPhase) {
        warnings.push(`Unusual phase value: ${signal.phase} (not close to 0 or π)`);
        quality *= 0.95;
      }
    }

    // Validate harmonics
    if (signal.harmonics) {
      if (signal.harmonics.length > 100) {
        errors.push(`Too many harmonics: ${signal.harmonics.length} (max 100)`);
        quality *= 0.7;
      }

      for (let i = 0; i < signal.harmonics.length; i++) {
        const harmonic = signal.harmonics[i];
        if (!Number.isFinite(harmonic)) {
          errors.push(`Invalid harmonic at index ${i}: ${harmonic}`);
          quality *= 0.8;
        } else if (Math.abs(harmonic) > 10) {
          warnings.push(`Large harmonic value at index ${i}: ${harmonic}`);
          quality *= 0.98;
        }
      }

      // Check for mathematical patterns in harmonics
      if (this.hasGoldenRatioPattern(signal.harmonics)) {
        quality *= 1.05; // Bonus for mathematical elegance
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      quality: Math.max(0, Math.min(1, quality))
    };
  }

  /**
   * Check if harmonics contain golden ratio patterns
   */
  private hasGoldenRatioPattern(harmonics: number[]): boolean {
    const phi = 1.618033988749;
    const tolerance = 0.01;
    
    for (const harmonic of harmonics) {
      if (Math.abs(harmonic - phi) < tolerance || 
          Math.abs(harmonic - (1/phi)) < tolerance) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate the size of a decoded signal in bytes
   */
  private calculateSignalSize(signal: ISILCSignal): number {
    let size = 12; // 3 floats (amplitude, frequency, phase)
    
    if (signal.harmonics) {
      size += signal.harmonics.length * 4; // Each harmonic is a float
    }
    
    return size;
  }

  /**
   * Decode multiple signals from a batch
   */
  public decodeBatch(encodedSignals: EncodedSignal[]): DecodingResult[] {
    return encodedSignals.map(encoded => this.decode(encoded));
  }

  /**
   * Auto-detect encoding format from encoded string
   */
  public detectFormat(encoded: string): SignalEncodingFormat {
    // Try to detect format based on content
    if (encoded.startsWith('{') && encoded.endsWith('}')) {
      return 'json';
    }
    
    if (encoded.length === 1 && /^[A-Za-z0-9+/]$/.test(encoded)) {
      return 'base64';
    }
    
    if (encoded.includes('H')) {
      return 'base64'; // Base64 with harmonics
    }
    
    // Try to decode as base64 and check if it's binary
    try {
      const buffer = Buffer.from(encoded, 'base64');
      if (buffer.length === 2) {
        return 'binary';
      }
      if (buffer.length >= 16) {
        return 'ieee754';
      }
    } catch {
      // Not valid base64
    }
    
    return 'base64'; // Default fallback
  }
}