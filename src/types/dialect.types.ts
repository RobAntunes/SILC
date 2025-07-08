/**
 * Dialect system type definitions for SILC Protocol
 */

import type { ISILCSignal } from './signal.types';

/**
 * Dialect pattern definition
 */
export interface IDialectPattern {
  /** Pattern identification */
  name: string;
  namespace: string;
  version: string;
  
  /** Signal definition */
  signalDefinition: {
    baseSignal: ISILCSignal;
    variations: ISILCSignal[];
    constraints: PatternConstraints;
  };
  
  /** Semantic meaning */
  semantics: {
    meaning: string;
    context: string[];
    examples: string[];
  };
  
  /** Usage statistics */
  usage: {
    frequency: number;
    effectiveness: number;
    adoptionRate: number;
    lastUsed: number;
  };
  
  /** Pattern relationships */
  relationships: {
    derivedFrom: string[];
    influences: string[];
    conflicts: string[];
  };
}

/**
 * Pattern constraints for validation
 */
export interface PatternConstraints {
  /** Amplitude range constraints */
  amplitudeRange: [number, number];
  
  /** Allowed frequency bands */
  frequencyBands: number[];
  
  /** Phase constraints */
  phaseConstraints: number[];
  
  /** Harmonic requirements */
  harmonicRequirements?: {
    minHarmonics: number;
    maxHarmonics: number;
    allowedRatios: number[];
  };
}

/**
 * Pattern discovery configuration
 */
export interface PatternDiscoveryConfig {
  /** Enable automatic pattern detection */
  enabled: boolean;
  
  /** Minimum usage count before consideration */
  minUsageCount: number;
  
  /** Effectiveness threshold (0-1) */
  effectivenessThreshold: number;
  
  /** Statistical significance threshold */
  significanceThreshold: number;
  
  /** Trial period in seconds */
  trialPeriod: number;
}

/**
 * Cross-dialect translation result
 */
export interface CrossDialectTranslation {
  /** Original signal */
  original: ISILCSignal;
  
  /** Translated signal */
  translated: ISILCSignal;
  
  /** Translation quality metrics */
  quality: {
    semanticFidelity: number;
    informationLoss: number;
    translationLatency: number;
    fallbackRequired: boolean;
  };
  
  /** Translation path */
  path: {
    sourceDialect: string;
    targetDialect: string;
    intermediateSteps: string[];
  };
}