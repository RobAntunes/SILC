/**
 * SILC Protocol Utility Functions
 *
 * Mathematical constants, signal utilities, and performance helpers
 * for the SILC protocol implementation.
 */

/**
 * Mathematical constants used in SILC signals
 */
export const MathConstants = {
  // Golden ratio and related values
  PHI: 1.618033988749,
  PHI_INVERSE: 0.618033988749,

  // Mathematical constants
  PI: Math.PI,
  E: Math.E,
  SQRT_2: Math.SQRT2,
  SQRT_3: 1.732050807568,

  // Fibonacci sequence (first 20 numbers)
  FIBONACCI: [
    1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
  ],

  // Common mathematical ratios
  RATIOS: {
    GOLDEN: 1.618033988749,
    SILVER: 2.414213562373,
    BRONZE: 3.302775637732,
    PLASTIC: 1.324717957245,
  },
} as const;

/**
 * Signal utility functions
 */
export class SignalUtils {
  /**
   * Generate a signal with golden ratio properties
   */
  public static createGoldenRatioSignal(baseFrequency: number = 3): {
    amplitude: number;
    frequency: number;
    phase: number;
    harmonics: number[];
  } {
    return {
      amplitude: MathConstants.PHI_INVERSE,
      frequency: baseFrequency,
      phase: 0,
      harmonics: [
        MathConstants.PHI,
        MathConstants.PHI_INVERSE,
        MathConstants.PHI - 1,
        1 / (MathConstants.PHI + 1),
      ],
    };
  }

  /**
   * Generate Fibonacci-based harmonics
   */
  public static createFibonacciHarmonics(count: number = 8): number[] {
    const harmonics: number[] = [];

    for (let i = 0; i < Math.min(count, MathConstants.FIBONACCI.length - 1); i++) {
      const ratio = (MathConstants.FIBONACCI[i + 1] ?? 1) / (MathConstants.FIBONACCI[i] ?? 1);
      harmonics.push(ratio);
    }

    return harmonics;
  }

  /**
   * Calculate signal complexity score
   */
  public static calculateComplexity(signal: {
    amplitude: number;
    frequency: number;
    phase: number;
    harmonics?: number[];
  }): number {
    let complexity = 1.0;

    // Base complexity from main signal
    complexity += Math.abs(signal.amplitude - 0.5) * 0.5; // Deviation from neutral
    complexity += signal.frequency * 0.1; // Frequency contributes to complexity
    complexity += (Math.abs(signal.phase) / Math.PI) * 0.3; // Phase complexity

    // Harmonic complexity
    if (signal.harmonics && signal.harmonics.length > 0) {
      const harmonicVariance = this.calculateVariance(signal.harmonics);
      complexity += harmonicVariance * 0.5;
      complexity += signal.harmonics.length * 0.1;
    }

    return Math.max(0, Math.min(10, complexity)); // Clamp to 0-10 range
  }

  /**
   * Calculate the variance of an array of numbers
   */
  public static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => (val - mean) ** 2);
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Normalize signal parameters to valid ranges
   */
  public static normalize(signal: {
    amplitude: number;
    frequency: number;
    phase: number;
    harmonics?: number[];
  }): {
    amplitude: number;
    frequency: number;
    phase: number;
    harmonics?: number[];
  } {
    const normalized = {
      amplitude: Math.max(0, Math.min(1, signal.amplitude)),
      frequency: Math.max(0, Math.min(7, Math.round(signal.frequency))),
      phase: ((signal.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
      harmonics: signal.harmonics?.map((h) => Math.max(-10, Math.min(10, h))),
    };

    // Quantize phase to canonical values if close
    if (Math.abs(normalized.phase) < 0.1) normalized.phase = 0;
    if (Math.abs(normalized.phase - Math.PI) < 0.1) normalized.phase = Math.PI;
    if (Math.abs(normalized.phase - 2 * Math.PI) < 0.1) normalized.phase = 0;

    return normalized;
  }

  /**
   * Check if two signals are similar within tolerance
   */
  public static areSimilar(
    signal1: { amplitude: number; frequency: number; phase: number },
    signal2: { amplitude: number; frequency: number; phase: number },
    tolerance: number = 0.1,
  ): boolean {
    return (
      Math.abs(signal1.amplitude - signal2.amplitude) <= tolerance &&
      Math.abs(signal1.frequency - signal2.frequency) <= tolerance &&
      Math.abs(signal1.phase - signal2.phase) <= tolerance
    );
  }

  /**
   * Generate a random signal with natural properties
   */
  public static createNaturalSignal(): {
    amplitude: number;
    frequency: number;
    phase: number;
    harmonics?: number[];
  } {
    // Use golden ratio-influenced randomness
    const phi = MathConstants.PHI;
    const random1 = (Math.random() * phi) % 1;
    const random2 = (Math.random() * phi) % 1;

    return {
      amplitude: 0.3 + random1 * 0.7, // Bias towards higher confidence
      frequency: Math.floor(random2 * 8), // Random frequency band
      phase: Math.random() < 0.8 ? 0 : Math.PI, // Mostly in-phase
      harmonics: Math.random() < 0.3 ? this.createFibonacciHarmonics(4) : undefined,
    };
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceUtils {
  private static measurements = new Map<string, number[]>();

  /**
   * Start a performance measurement
   */
  public static startMeasurement(key: string): void {
    if (!this.measurements.has(key)) {
      this.measurements.set(key, []);
    }
    this.measurements.get(key)!.push(performance.now());
  }

  /**
   * End a performance measurement and return duration
   */
  public static endMeasurement(key: string): number {
    const measurements = this.measurements.get(key);
    if (!measurements || measurements.length === 0) {
      throw new Error(`No active measurement found for key: ${key}`);
    }

    const startTime = measurements.pop()!;
    const duration = performance.now() - startTime;

    return duration;
  }

  /**
   * Measure execution time of a function
   */
  public static async measure<T>(
    operation: () => Promise<T> | T,
    key?: string,
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      if (key) {
        this.recordMeasurement(key, duration);
      }

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;

      if (key) {
        this.recordMeasurement(`${key}_error`, duration);
      }

      throw error;
    }
  }

  /**
   * Record a measurement
   */
  public static recordMeasurement(key: string, duration: number): void {
    if (!this.measurements.has(key)) {
      this.measurements.set(key, []);
    }

    const measurements = this.measurements.get(key)!;
    measurements.push(duration);

    // Keep only last 1000 measurements
    if (measurements.length > 1000) {
      measurements.shift();
    }
  }

  /**
   * Get performance statistics for a key
   */
  public static getStatistics(key: string): {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(key);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      mean: sorted.reduce((sum, val) => sum + val, 0) / count,
      median: sorted[Math.floor(count / 2)] ?? 0,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0,
    };
  }

  /**
   * Clear all measurements
   */
  public static clearMeasurements(): void {
    this.measurements.clear();
  }

  /**
   * Get all measurement keys
   */
  public static getKeys(): string[] {
    return Array.from(this.measurements.keys());
  }
}

/**
 * Utility for working with Base64 signal encoding
 */
export class Base64Utils {
  private static readonly BASE64_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /**
   * Get the index of a Base64 character
   */
  public static getCharIndex(char: string): number {
    return this.BASE64_CHARS.indexOf(char);
  }

  /**
   * Get Base64 character at index
   */
  public static getCharAt(index: number): string {
    if (index < 0 || index >= 64) {
      throw new Error(`Invalid Base64 index: ${index}`);
    }
    return this.BASE64_CHARS[index] ?? 'A';
  }

  /**
   * Validate Base64 character
   */
  public static isValidChar(char: string): boolean {
    return this.BASE64_CHARS.includes(char);
  }

  /**
   * Generate a random Base64 character
   */
  public static randomChar(): string {
    return this.BASE64_CHARS[Math.floor(Math.random() * 64)] ?? 'A';
  }

  /**
   * Generate a random Base64 string of given length
   */
  public static randomString(length: number): string {
    return Array.from({ length }, () => this.randomChar()).join('');
  }
}
