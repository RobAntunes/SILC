/**
 * SILC Interpreter for Model Integration
 *
 * Provides the interface for AI models to understand and generate
 * SILC signals based on semantic intent.
 */

import type { ISILCMessage, ISILCSignal, SignalParameters } from '../types/message.types';
import { SignalEncoder } from '../signal/encoder';
import { SignalDecoder } from '../signal/decoder';
import { SignalValidator } from '../signal/validator';
import { PatternDiscovery } from '../dialect/pattern-discovery';

/**
 * Semantic intent that models express
 */
export interface SemanticIntent {
  confidence: number; // 0-1, how certain the model is
  urgency: number; // 0-1, how urgent the communication is
  agreement: boolean; // Whether the model agrees/disagrees
  complexity: number; // 0-1, complexity of the concept
  emotion?: string; // Optional emotional context
  domain?: string; // Optional domain context
}

/**
 * Interpretation result
 */
export interface InterpretationResult {
  intent: SemanticIntent;
  context: {
    patternMatched?: string;
    confidence: number;
    alternativeInterpretations?: SemanticIntent[];
  };
}

/**
 * SILC teaching examples for models
 */
export interface TeachingExample {
  description: string;
  intent: SemanticIntent;
  signal: ISILCSignal;
  explanation: string;
}

/**
 * SILC Interpreter Implementation
 */
export class SILCInterpreter {
  private encoder: SignalEncoder;
  private decoder: SignalDecoder;
  private validator: SignalValidator;
  private patternMemory = new Map<string, ISILCSignal[]>();

  constructor() {
    this.encoder = new SignalEncoder();
    this.decoder = new SignalDecoder();
    this.validator = new SignalValidator();
  }

  /**
   * Convert semantic intent to SILC signal
   */
  intentToSignal(intent: SemanticIntent): ISILCSignal {
    // Map confidence directly to amplitude (0-1)
    const amplitude = intent.confidence;

    // Map urgency to frequency bands (0-7)
    const frequency = Math.round(intent.urgency * 7);

    // Map agreement to phase (0 for agreement, π for disagreement)
    const phase = intent.agreement ? 0 : Math.PI;

    // Generate harmonics based on complexity
    const harmonics = this.generateHarmonics(intent.complexity, intent.domain);

    const signal: ISILCSignal = {
      amplitude,
      frequency,
      phase,
      harmonics,
    };

    return signal;
  }

  /**
   * Interpret SILC signal to semantic intent
   */
  signalToIntent(signal: ISILCSignal): InterpretationResult {
    // Validate signal first
    const validation = this.validator.validate(signal);
    if (!validation.valid) {
      throw new Error(`Invalid signal: ${validation.errors.join(', ')}`);
    }

    // Extract semantic meaning
    const intent: SemanticIntent = {
      confidence: signal.amplitude,
      urgency: signal.frequency / 7,
      agreement: signal.phase === 0,
      complexity: this.calculateComplexity(signal.harmonics),
    };

    // Check for pattern matches
    const patternMatch = this.findPatternMatch(signal);

    return {
      intent,
      context: {
        patternMatched: patternMatch,
        confidence: validation.quality || 0.5,
      },
    };
  }

  /**
   * Generate teaching examples for model training
   */
  getTeachingExamples(): TeachingExample[] {
    return [
      {
        description: 'High confidence agreement',
        intent: {
          confidence: 0.9,
          urgency: 0.3,
          agreement: true,
          complexity: 0.2,
        },
        signal: {
          amplitude: 0.9,
          frequency: 2,
          phase: 0,
          harmonics: [0.618],
        },
        explanation:
          'Strong, clear agreement with moderate urgency. The high amplitude (0.9) shows confidence, low frequency (2) indicates calm communication, and phase 0 means agreement.',
      },
      {
        description: 'Urgent disagreement',
        intent: {
          confidence: 0.8,
          urgency: 0.9,
          agreement: false,
          complexity: 0.3,
        },
        signal: {
          amplitude: 0.8,
          frequency: 6,
          phase: Math.PI,
          harmonics: [0.382, 0.618],
        },
        explanation:
          'Confident disagreement with high urgency. High frequency (6) indicates urgency, phase π shows disagreement, and multiple harmonics suggest nuanced reasoning.',
      },
      {
        description: 'Uncertain exploration',
        intent: {
          confidence: 0.3,
          urgency: 0.4,
          agreement: true,
          complexity: 0.7,
        },
        signal: {
          amplitude: 0.3,
          frequency: 3,
          phase: 0,
          harmonics: [0.618, 0.382, 0.5, 0.333],
        },
        explanation:
          'Low confidence exploration of complex ideas. Low amplitude (0.3) shows uncertainty, while many harmonics indicate conceptual complexity.',
      },
      {
        description: 'Emergency alert',
        intent: {
          confidence: 1.0,
          urgency: 1.0,
          agreement: true,
          complexity: 0.1,
        },
        signal: {
          amplitude: 1.0,
          frequency: 7,
          phase: 0,
        },
        explanation:
          'Maximum urgency and confidence. Amplitude at 1.0 and frequency at 7 indicate critical importance. No harmonics keeps the message simple and clear.',
      },
    ];
  }

  /**
   * Create learning prompt for models
   */
  createLearningPrompt(): string {
    return `SILC (Self-Interpreting Local Communication) Training:

SILC enables AI-to-AI communication through mathematical signals instead of human language.

Core Components:
1. Amplitude (0.0-1.0): Represents confidence/certainty
   - 0.0 = No confidence
   - 0.5 = Moderate confidence  
   - 1.0 = Complete certainty

2. Frequency (0-7): Indicates urgency/priority
   - 0-2 = Low urgency
   - 3-5 = Normal urgency
   - 6-7 = High urgency

3. Phase (0 or π): Shows agreement/relationship
   - 0 = Agreement, positive relationship
   - π = Disagreement, negative relationship

4. Harmonics (optional): Encode complexity and nuance
   - Golden ratio (0.618, 0.382) for balanced concepts
   - Simple ratios (0.5, 0.333) for structured ideas

When communicating with SILC:
- Think about your confidence level → amplitude
- Consider the urgency → frequency  
- Determine agreement/disagreement → phase
- Add harmonics for complex ideas

The beauty of SILC is that these signals are self-interpreting - the mathematical relationships inherently carry meaning that AI systems naturally understand.`;
  }

  /**
   * Generate harmonics based on complexity
   */
  private generateHarmonics(complexity: number, domain?: string): number[] | undefined {
    if (complexity < 0.2) {
      return undefined; // Simple message, no harmonics
    }

    const harmonics: number[] = [];

    // Add golden ratio for balanced complexity
    if (complexity > 0.3) {
      harmonics.push(0.618);
    }

    // Add complementary golden ratio
    if (complexity > 0.5) {
      harmonics.push(0.382);
    }

    // Add domain-specific harmonics
    if (domain && complexity > 0.7) {
      switch (domain) {
        case 'logic':
          harmonics.push(0.5); // Binary logic
          break;
        case 'creative':
          harmonics.push(0.333, 0.667); // Thirds for creativity
          break;
        default:
          harmonics.push(0.5);
      }
    }

    return harmonics.length > 0 ? harmonics : undefined;
  }

  /**
   * Calculate complexity from harmonics
   */
  private calculateComplexity(harmonics?: number[]): number {
    if (!harmonics || harmonics.length === 0) {
      return 0.1; // Simple signal
    }

    // More harmonics = more complexity
    const countFactor = Math.min(1, harmonics.length / 4);

    // Variety of harmonics also indicates complexity
    const uniqueHarmonics = new Set(harmonics).size;
    const varietyFactor = uniqueHarmonics / harmonics.length;

    return countFactor * 0.7 + varietyFactor * 0.3;
  }

  /**
   * Find pattern match in memory
   */
  private findPatternMatch(signal: ISILCSignal): string | undefined {
    // This would integrate with PatternDiscovery in full implementation
    // For now, check basic pattern matching

    // High confidence agreement pattern
    if (signal.amplitude > 0.8 && signal.frequency < 3 && signal.phase === 0) {
      return 'high-confidence-agreement';
    }

    // Urgent alert pattern
    if (signal.amplitude > 0.9 && signal.frequency > 6) {
      return 'urgent-alert';
    }

    // Uncertain exploration pattern
    if (signal.amplitude < 0.4 && signal.harmonics && signal.harmonics.length > 2) {
      return 'uncertain-exploration';
    }

    return undefined;
  }

  /**
   * Learn from model usage
   */
  learnPattern(intent: SemanticIntent, signal: ISILCSignal, context: string): void {
    const patternKey = `${context}-${Math.round(intent.confidence * 10)}-${Math.round(intent.urgency * 10)}`;

    if (!this.patternMemory.has(patternKey)) {
      this.patternMemory.set(patternKey, []);
    }

    this.patternMemory.get(patternKey)!.push(signal);
  }
}
