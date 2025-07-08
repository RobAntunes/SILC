/**
 * SILC Signal Validation Utilities
 * 
 * Comprehensive validation for SILC signals including parameter ranges,
 * mathematical patterns, and quality assessment.
 */

import type { 
  ISILCSignal, 
  SignalValidationResult, 
  SignalQualityMetrics 
} from '../types/signal.types';
import { SILCErrorCategory, ErrorSeverity } from '../types/common.types';
import { SILCError } from '../core/errors';

/**
 * Signal validation configuration
 */
export interface ValidationConfig {
  /** Strict mode - fail on warnings */
  strict: boolean;
  
  /** Enable mathematical pattern detection */
  detectPatterns: boolean;
  
  /** Maximum allowed harmonics */
  maxHarmonics: number;
  
  /** Tolerance for phase validation */
  phaseTolerance: number;
  
  /** Enable quality scoring */
  enableQualityScoring: boolean;
}

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG: ValidationConfig = {
  strict: false,
  detectPatterns: true,
  maxHarmonics: 100,
  phaseTolerance: 0.1,
  enableQualityScoring: true
};

/**
 * Known mathematical patterns in signals
 */
export const MathematicalPatterns = {
  GOLDEN_RATIO: 1.618033988749,
  EULER: 2.718281828459,
  PI: 3.141592653589,
  SQRT_2: 1.414213562373,
  SQRT_3: 1.732050807568,
  FIBONACCI_RATIOS: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55].map((n, i, arr) => 
    i === 0 ? 1 : n / (arr[i - 1] ?? 1)
  )
} as const;

/**
 * SILC Signal Validator Class
 */
export class SignalValidator {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate a SILC signal comprehensively
   */
  public validate(signal: ISILCSignal): SignalValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let quality = 1.0;

    // Basic parameter validation
    const basicValidation = this.validateBasicParameters(signal);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);
    quality *= basicValidation.qualityMultiplier;

    // Mathematical pattern validation
    if (this.config.detectPatterns) {
      const patternValidation = this.validateMathematicalPatterns(signal);
      warnings.push(...patternValidation.warnings);
      quality *= patternValidation.qualityMultiplier;
    }

    // Harmonic validation
    if (signal.harmonics) {
      const harmonicValidation = this.validateHarmonics(signal.harmonics);
      errors.push(...harmonicValidation.errors);
      warnings.push(...harmonicValidation.warnings);
      quality *= harmonicValidation.qualityMultiplier;
    }

    // Self-interpreting properties validation
    const selfInterpretingValidation = this.validateSelfInterpretingProperties(signal);
    warnings.push(...selfInterpretingValidation.warnings);
    quality *= selfInterpretingValidation.qualityMultiplier;

    // Apply strict mode
    const allIssues = this.config.strict ? [...errors, ...warnings] : errors;

    return {
      valid: allIssues.length === 0,
      errors,
      warnings,
      quality: Math.max(0, Math.min(1, quality))
    };
  }

  /**
   * Validate basic signal parameters
   */
  private validateBasicParameters(signal: ISILCSignal): {
    errors: string[];
    warnings: string[];
    qualityMultiplier: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let qualityMultiplier = 1.0;

    // Amplitude validation
    if (signal.amplitude < 0 || signal.amplitude > 1) {
      errors.push(`Amplitude ${signal.amplitude} out of range [0, 1]`);
      qualityMultiplier *= 0.5;
    } else if (signal.amplitude === 0) {
      warnings.push('Zero amplitude indicates no confidence');
      qualityMultiplier *= 0.9;
    } else if (signal.amplitude > 0.95) {
      // Very high confidence - good for quality
      qualityMultiplier *= 1.05;
    }

    // Frequency validation
    if (!Number.isInteger(signal.frequency) || signal.frequency < 0 || signal.frequency > 7) {
      errors.push(`Frequency ${signal.frequency} must be integer in range [0, 7]`);
      qualityMultiplier *= 0.5;
    }

    // Phase validation
    if (!Number.isFinite(signal.phase)) {
      errors.push(`Phase ${signal.phase} must be finite`);
      qualityMultiplier *= 0.5;
    } else {
      // Check if phase is close to canonical values (0 or π)
      const normalizedPhase = ((signal.phase % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
      const isCanonical = Math.abs(normalizedPhase) < this.config.phaseTolerance || 
                         Math.abs(normalizedPhase - Math.PI) < this.config.phaseTolerance ||
                         Math.abs(normalizedPhase - 2 * Math.PI) < this.config.phaseTolerance;
      
      if (!isCanonical) {
        warnings.push(`Non-canonical phase ${signal.phase} (not close to 0 or π)`);
        qualityMultiplier *= 0.95;
      }
    }

    return { errors, warnings, qualityMultiplier };
  }

  /**
   * Validate mathematical patterns in the signal
   */
  private validateMathematicalPatterns(signal: ISILCSignal): {
    warnings: string[];
    qualityMultiplier: number;
  } {
    const warnings: string[] = [];
    let qualityMultiplier = 1.0;

    // Check for golden ratio patterns
    if (this.isCloseToValue(signal.amplitude, 1 / MathematicalPatterns.GOLDEN_RATIO, 0.01)) {
      qualityMultiplier *= 1.1; // Bonus for mathematical elegance
    }

    // Check for mathematical constants in harmonics
    if (signal.harmonics) {
      const hasGoldenRatio = signal.harmonics.some(h => 
        this.isCloseToValue(h, MathematicalPatterns.GOLDEN_RATIO, 0.01) ||
        this.isCloseToValue(h, 1 / MathematicalPatterns.GOLDEN_RATIO, 0.01)
      );
      
      const hasEuler = signal.harmonics.some(h => 
        this.isCloseToValue(h, MathematicalPatterns.EULER, 0.01)
      );
      
      const hasPi = signal.harmonics.some(h => 
        this.isCloseToValue(h, MathematicalPatterns.PI, 0.01)
      );

      if (hasGoldenRatio || hasEuler || hasPi) {
        qualityMultiplier *= 1.15; // Bonus for mathematical constants
      }

      // Check for Fibonacci ratio patterns
      if (this.hasFibonacciRatios(signal.harmonics)) {
        qualityMultiplier *= 1.1;
      }
    }

    return { warnings, qualityMultiplier };
  }

  /**
   * Validate harmonic components
   */
  private validateHarmonics(harmonics: number[]): {
    errors: string[];
    warnings: string[];
    qualityMultiplier: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let qualityMultiplier = 1.0;

    // Check harmonic count
    if (harmonics.length > this.config.maxHarmonics) {
      errors.push(`Too many harmonics: ${harmonics.length} (max ${this.config.maxHarmonics})`);
      qualityMultiplier *= 0.7;
    }

    // Validate individual harmonics
    for (let i = 0; i < harmonics.length; i++) {
      const harmonic = harmonics[i];
      
      if (!Number.isFinite(harmonic)) {
        errors.push(`Invalid harmonic at index ${i}: ${harmonic}`);
        qualityMultiplier *= 0.8;
      } else if (Math.abs(harmonic) > 100) {
        warnings.push(`Very large harmonic at index ${i}: ${harmonic}`);
        qualityMultiplier *= 0.95;
      } else if (harmonic === 0) {
        warnings.push(`Zero harmonic at index ${i} adds no information`);
        qualityMultiplier *= 0.98;
      }
    }

    // Check for harmonic structure quality
    const structureQuality = this.assessHarmonicStructure(harmonics ?? []);
    qualityMultiplier *= structureQuality;

    return { errors, warnings, qualityMultiplier };
  }

  /**
   * Validate self-interpreting properties
   */
  private validateSelfInterpretingProperties(signal: ISILCSignal): {
    warnings: string[];
    qualityMultiplier: number;
  } {
    const warnings: string[] = [];
    let qualityMultiplier = 1.0;

    // Check signal coherence
    const isCoherent = this.isSignalCoherent(signal);
    if (!isCoherent) {
      warnings.push('Signal lacks coherence for AI interpretation');
      qualityMultiplier *= 0.9;
    }

    // Check semantic consistency
    const isConsistent = this.isSemanticConsistent(signal);
    if (!isConsistent) {
      warnings.push('Signal semantics may be inconsistent');
      qualityMultiplier *= 0.95;
    }

    return { warnings, qualityMultiplier };
  }

  /**
   * Check if signal is coherent for AI interpretation
   */
  private isSignalCoherent(signal: ISILCSignal): boolean {
    // High frequency with low amplitude suggests urgency without confidence
    if (signal.frequency > 5 && signal.amplitude < 0.3) {
      return false;
    }

    // Very high confidence with contradictory phase
    if (signal.amplitude > 0.9 && signal.phase > Math.PI / 2) {
      return false;
    }

    return true;
  }

  /**
   * Check semantic consistency
   */
  private isSemanticConsistent(signal: ISILCSignal): boolean {
    // Zero amplitude with complex harmonics doesn't make sense
    if (signal.amplitude === 0 && signal.harmonics && signal.harmonics.length > 0) {
      return false;
    }

    // Low frequency (idle) with high amplitude suggests inconsistency
    if (signal.frequency === 0 && signal.amplitude > 0.8) {
      return false;
    }

    return true;
  }

  /**
   * Assess harmonic structure quality
   */
  private assessHarmonicStructure(harmonics: number[]): number {
    if (harmonics.length === 0) return 1.0;

    let qualityScore = 1.0;

    // Check for decreasing amplitude pattern (natural harmonic series)
    const hasDecreasingPattern = this.hasDecreasingPattern(harmonics);
    if (hasDecreasingPattern) {
      qualityScore *= 1.1;
    }

    // Check for excessive noise (random patterns)
    const noiseLevel = this.calculateNoiseLevel(harmonics);
    if (noiseLevel > 0.8) {
      qualityScore *= 0.8;
    } else if (noiseLevel < 0.2) {
      qualityScore *= 1.05; // Clean signal
    }

    return qualityScore;
  }

  /**
   * Check if values follow decreasing pattern
   */
  private hasDecreasingPattern(values: number[]): boolean {
    if (values.length < 3) return false;

    let decreasingCount = 0;
    for (let i = 1; i < values.length; i++) {
      if (Math.abs(values[i] ?? 0) < Math.abs(values[i - 1] ?? 0)) {
        decreasingCount++;
      }
    }

    return decreasingCount / (values.length - 1) > 0.7;
  }

  /**
   * Calculate noise level in harmonics
   */
  private calculateNoiseLevel(harmonics: number[]): number {
    if (harmonics.length < 2) return 0;

    // Calculate variance as a measure of noise
    const mean = harmonics.reduce((sum, h) => sum + h, 0) / harmonics.length;
    const variance = harmonics.reduce((sum, h) => sum + (h - mean) ** 2, 0) / harmonics.length;
    const stdDev = Math.sqrt(variance);

    // Normalize to [0, 1] range
    return Math.min(1, stdDev / (Math.abs(mean) + 1));
  }

  /**
   * Check if harmonics contain Fibonacci ratios
   */
  private hasFibonacciRatios(harmonics: number[]): boolean {
    for (let i = 1; i < harmonics.length; i++) {
      if (harmonics[i] !== 0) {
        const ratio = Math.abs((harmonics[i - 1] ?? 0) / (harmonics[i] ?? 1));
        
        for (const fibRatio of MathematicalPatterns.FIBONACCI_RATIOS) {
          if (this.isCloseToValue(ratio, fibRatio, 0.05)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Check if value is close to target within tolerance
   */
  private isCloseToValue(value: number, target: number, tolerance: number): boolean {
    return Math.abs(value - target) <= tolerance;
  }

  /**
   * Get quality metrics for a signal
   */
  public getQualityMetrics(signal: ISILCSignal): SignalQualityMetrics {
    const noiseLevel = signal.harmonics ? this.calculateNoiseLevel(signal.harmonics) : 0;
    
    return {
      snr: 1 - noiseLevel, // Signal-to-noise ratio
      harmonicDistortion: noiseLevel * 100, // As percentage
      frequencyAccuracy: signal.frequency === Math.floor(signal.frequency) ? 1.0 : 0.5,
      phaseStability: this.calculatePhaseStability(signal.phase)
    };
  }

  /**
   * Calculate phase stability metric
   */
  private calculatePhaseStability(phase: number): number {
    const normalizedPhase = ((phase % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    const distanceToCanonical = Math.min(
      Math.abs(normalizedPhase),
      Math.abs(normalizedPhase - Math.PI),
      Math.abs(normalizedPhase - 2 * Math.PI)
    );
    
    return Math.max(0, 1 - distanceToCanonical / (Math.PI / 2));
  }

  /**
   * Validate multiple signals in batch
   */
  public validateBatch(signals: ISILCSignal[]): SignalValidationResult[] {
    return signals.map(signal => this.validate(signal));
  }

  /**
   * Create a validation error for invalid signals
   */
  public createValidationError(
    message: string,
    _category: SILCErrorCategory = SILCErrorCategory.INVALID_SIGNAL_PARAMETERS
  ): Error {
    return new Error(message);
  }
}