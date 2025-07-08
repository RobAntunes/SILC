/**
 * SILC Signal Processing Module
 * 
 * Main entry point for signal processing components including encoding,
 * decoding, validation, and the unified signal processor.
 */

// Re-export core signal types
export type {
  ISILCSignal,
  SignalParameters,
  EncodedSignal,
  SignalValidationResult,
  SignalQualityMetrics,
  SignalEncodingFormat,
  HarmonicCoefficients,
  CompressionInfo
} from '../types/signal.types';

// Re-export individual components
export { SignalEncoder } from './encoder';
export { SignalDecoder } from './decoder';
export { SignalValidator } from './validator';

// Re-export unified signal processor
export { SILCSignal } from './signal';

/**
 * Simplified signal creation function
 */
export function createSignal(amplitude: number, frequency: number, phase: number, harmonics?: number[]) {
  return {
    amplitude,
    frequency,
    phase,
    harmonics
  };
}

/**
 * Create a golden ratio signal
 */
export function createGoldenRatioSignal(amplitude: number = 0.618) {
  return createSignal(amplitude, 1.618, 0, [1.618, 2.618, 4.236]);
}

/**
 * Create a Fibonacci sequence signal
 */
export function createFibonacciSignal(amplitude: number = 1.0) {
  return createSignal(amplitude, 1, 0, [1, 1, 2, 3, 5, 8]);
}

/**
 * Create an Euler-based signal
 */
export function createEulerSignal(amplitude: number = 0.718) {
  return createSignal(amplitude, 2.718, 0, [2.718, 7.389, 20.086]);
}

/**
 * Create a pi-based signal for periodic patterns
 */
export function createPiSignal(amplitude: number = 1.0) {
  return createSignal(amplitude, 3.141, Math.PI, [3.141, 9.870, 31.006]);
}

/**
 * Quick validation function
 */
export function isValidSignal(signal: any): boolean {
  return (
    signal &&
    typeof signal === 'object' &&
    typeof signal.amplitude === 'number' &&
    typeof signal.frequency === 'number' &&
    typeof signal.phase === 'number' &&
    signal.amplitude >= 0 &&
    signal.amplitude <= 1 &&
    signal.frequency >= 0 &&
    signal.frequency <= 7 &&
    (signal.phase === 0 || signal.phase === Math.PI)
  );
}