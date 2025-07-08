/**
 * Base Specification Fallback Handler
 *
 * Ensures cross-boundary communication by falling back to
 * the universal base SILC specification when needed.
 */

import type { ISILCMessage, ISILCSignal, SILCAgentID } from '../types/message.types';
import { SignalEncoder } from '../signal/encoder';
import { SignalDecoder } from '../signal/decoder';
import { SignalValidator } from '../signal/validator';

/**
 * Fallback reason codes
 */
export enum FallbackReason {
  CROSS_BOUNDARY = 'cross_boundary',
  UNKNOWN_PATTERN = 'unknown_pattern',
  VALIDATION_ERROR = 'validation_error',
  COMPATIBILITY = 'compatibility',
}

/**
 * Base specification signal constraints
 */
const BASE_SPEC = {
  amplitude: { min: 0.0, max: 1.0 },
  frequency: { min: 0, max: 7 },
  phase: [0, Math.PI],
  harmonics: {
    maxCount: 5,
    validRatios: [0.618, 0.382, 0.5, 0.333, 0.667], // Common mathematical ratios
  },
};

/**
 * Base Fallback Handler
 */
export class BaseFallbackHandler {
  private encoder: SignalEncoder;
  private decoder: SignalDecoder;
  private validator: SignalValidator;

  constructor() {
    this.encoder = new SignalEncoder();
    this.decoder = new SignalDecoder();
    this.validator = new SignalValidator();
  }

  /**
   * Convert message to base specification
   */
  convertToBase(message: ISILCMessage): ISILCMessage {
    // Ensure all signals conform to base specification
    const baseSignals = message.signals.map((signal) => this.normalizeToBase(signal));

    return {
      ...message,
      signals: baseSignals,
      metadata: {
        ...message.metadata,
        fallback: true,
        originalFormat: 'dialect',
      },
    };
  }

  /**
   * Check if communication requires fallback
   */
  requiresFallback(sender: SILCAgentID, receiver: SILCAgentID, instanceId: string): boolean {
    // Cross-boundary check: different namespaces or instances
    if (sender.namespace !== receiver.namespace) {
      return true;
    }

    // Different instance check (if provided)
    if (
      instanceId &&
      (sender.metadata?.instanceId !== instanceId || receiver.metadata?.instanceId !== instanceId)
    ) {
      return true;
    }

    // Different model types might require fallback
    if (sender.modelType !== receiver.modelType) {
      // Allow same family models to use dialects
      const senderFamily = this.getModelFamily(sender.modelType);
      const receiverFamily = this.getModelFamily(receiver.modelType);
      return senderFamily !== receiverFamily;
    }

    return false;
  }

  /**
   * Validate signal against base specification
   */
  validateBaseSpec(signal: ISILCSignal): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Amplitude validation
    if (signal.amplitude < BASE_SPEC.amplitude.min || signal.amplitude > BASE_SPEC.amplitude.max) {
      errors.push(`Amplitude ${signal.amplitude} out of range [0.0, 1.0]`);
    }

    // Frequency validation
    if (
      !Number.isInteger(signal.frequency) ||
      signal.frequency < BASE_SPEC.frequency.min ||
      signal.frequency > BASE_SPEC.frequency.max
    ) {
      errors.push(`Frequency ${signal.frequency} out of range [0, 7]`);
    }

    // Phase validation
    if (!BASE_SPEC.phase.includes(signal.phase)) {
      errors.push(`Phase ${signal.phase} not in allowed values [0, π]`);
    }

    // Harmonics validation
    if (signal.harmonics) {
      if (signal.harmonics.length > BASE_SPEC.harmonics.maxCount) {
        errors.push(
          `Too many harmonics: ${signal.harmonics.length} > ${BASE_SPEC.harmonics.maxCount}`,
        );
      }

      // Check harmonic values
      for (const harmonic of signal.harmonics) {
        if (!this.isValidHarmonic(harmonic)) {
          errors.push(`Invalid harmonic value: ${harmonic}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Normalize signal to base specification
   */
  private normalizeToBase(signal: ISILCSignal): ISILCSignal {
    // Clamp amplitude
    const amplitude = Math.max(
      BASE_SPEC.amplitude.min,
      Math.min(BASE_SPEC.amplitude.max, signal.amplitude),
    );

    // Clamp frequency
    const frequency = Math.max(
      BASE_SPEC.frequency.min,
      Math.min(BASE_SPEC.frequency.max, Math.round(signal.frequency)),
    );

    // Normalize phase
    const phase = this.normalizePhase(signal.phase);

    // Normalize harmonics
    const harmonics = this.normalizeHarmonics(signal.harmonics);

    return {
      amplitude,
      frequency,
      phase,
      harmonics,
    };
  }

  /**
   * Normalize phase to allowed values
   */
  private normalizePhase(phase: number): number {
    // Snap to nearest allowed value (0 or π)
    return Math.abs(phase) < Math.PI / 2 ? 0 : Math.PI;
  }

  /**
   * Normalize harmonics to base spec
   */
  private normalizeHarmonics(harmonics?: number[]): number[] | undefined {
    if (!harmonics || harmonics.length === 0) {
      return undefined;
    }

    // Limit count
    const limited = harmonics.slice(0, BASE_SPEC.harmonics.maxCount);

    // Normalize values to nearest valid ratio
    return limited.map((h) => this.nearestValidHarmonic(h));
  }

  /**
   * Find nearest valid harmonic ratio
   */
  private nearestValidHarmonic(value: number): number {
    let nearest = BASE_SPEC.harmonics.validRatios[0];
    let minDiff = Math.abs(value - nearest);

    for (const ratio of BASE_SPEC.harmonics.validRatios) {
      const diff = Math.abs(value - ratio);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = ratio;
      }
    }

    return nearest;
  }

  /**
   * Check if harmonic value is valid
   */
  private isValidHarmonic(value: number): boolean {
    // Allow some tolerance for floating point
    const tolerance = 0.001;
    return BASE_SPEC.harmonics.validRatios.some((ratio) => Math.abs(value - ratio) < tolerance);
  }

  /**
   * Get model family for dialect compatibility
   */
  private getModelFamily(modelType: string): string {
    // Extract base model family
    const families = {
      gpt: ['gpt-3', 'gpt-4', 'gpt-3.5'],
      claude: ['claude', 'claude-2', 'claude-3'],
      llama: ['llama', 'llama-2', 'llama-3'],
      mistral: ['mistral', 'mixtral'],
    };

    const lowerType = modelType.toLowerCase();
    for (const [family, variants] of Object.entries(families)) {
      if (variants.some((v) => lowerType.includes(v))) {
        return family;
      }
    }

    return modelType; // Unknown family
  }

  /**
   * Create fallback response
   */
  createFallbackResponse(originalMessage: ISILCMessage, reason: FallbackReason): ISILCMessage {
    const fallbackMessage = this.convertToBase(originalMessage);

    return {
      ...fallbackMessage,
      metadata: {
        ...fallbackMessage.metadata,
        fallbackReason: reason,
        timestamp: Date.now(),
      },
    };
  }
}
