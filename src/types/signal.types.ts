/**
 * Core signal type definitions for SILC Protocol
 */

/**
 * Fundamental SILC signal components
 */
export interface ISILCSignal {
  /** Signal strength/confidence (0.0-1.0) */
  amplitude: number;

  /** Oscillation pattern/urgency (0-7 bands) */
  frequency: number;

  /** Timing offset/relationship (0 or π radians) */
  phase: number;

  /** Complex meaning patterns (optional) */
  harmonics?: number[];
}

/**
 * Parameters for creating a new signal
 */
export interface SignalParameters {
  amplitude: number;
  frequency: number;
  phase: number;
  harmonics?: number[];
}

/**
 * Harmonic coefficient encoding information
 */
export interface HarmonicCoefficients {
  /** Array of harmonic amplitudes */
  coefficients: Float32Array;

  /** Harmonic frequency multipliers */
  frequencies: number[];

  /** Harmonic phase offsets */
  phases: Float32Array;
}

/**
 * Enhanced signal with encoding metadata
 */
export interface EncodedSignal {
  /** Base signal data */
  signal: ISILCSignal;

  /** Base64 encoded signal string */
  encoded: string;

  /** Encoding metadata */
  encoding: {
    method: 'base64' | 'ieee754' | 'custom';
    compressionRatio?: number;
    size: number;
  };

  /** Signal validation checksum */
  checksum: string;
}

/**
 * Signal validation result
 */
export interface SignalValidationResult {
  /** Whether signal is valid */
  valid: boolean;

  /** Validation errors if any */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Signal quality score (0-1) */
  quality: number;
}

/**
 * Signal compression information
 */
export interface CompressionInfo {
  /** Compression algorithm used */
  algorithm: 'none' | 'zlib' | 'lz4' | 'custom';

  /** Compression level (0-9) */
  level: number;

  /** Achieved compression ratio */
  ratio: number;
}

/**
 * Signal encoding format options
 */
export type SignalEncodingFormat = 'base64' | 'ieee754' | 'binary' | 'json';

/**
 * Signal quality metrics
 */
export interface SignalQualityMetrics {
  /** Signal-to-noise ratio */
  snr: number;

  /** Harmonic distortion percentage */
  harmonicDistortion: number;

  /** Frequency accuracy */
  frequencyAccuracy: number;

  /** Phase stability */
  phaseStability: number;
}
