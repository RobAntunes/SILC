/**
 * SILC Dialect Type Definitions
 *
 * Types for dialect system that enables evolving communication patterns
 * between AI agents through organic discovery.
 */

import type { ISILCSignal, SILCAgentID } from './message.types';

/**
 * Pattern effectiveness metrics
 */
export interface PatternMetrics {
  effectiveness: number; // 0-1, how well the pattern achieves communication goals
  efficiency: number; // 0-1, information density vs pattern length
  accuracy: number; // 0-1, consistency of pattern usage
  adoptionRate: number; // Occurrences per hour
  lastUpdated: number; // Timestamp of last metric update
}

/**
 * Discovered communication pattern
 */
export interface DiscoveredPattern {
  id: string; // Unique pattern identifier
  signals: ISILCSignal[]; // The signal sequence that forms the pattern
  metadata: {
    // Pattern metadata
    occurrences: number;
    firstSeen: number;
    lastSeen: number;
    contexts: any; // Summary of usage contexts
  };
  effectiveness: number; // Overall effectiveness score
  adoptionRate: number; // How quickly the pattern is being adopted
}

/**
 * Pattern usage context
 */
export interface PatternContext {
  agentPair: {
    // Agents using this pattern
    sender: SILCAgentID;
    receiver: SILCAgentID;
  };
  domainHint?: string; // Optional domain context (e.g., 'reasoning', 'creative')
  timestamp: number; // When the pattern was used
  success: boolean; // Whether communication was successful
}

/**
 * Dialect scope boundaries
 */
export interface DialectScope {
  instanceId: string; // Program instance boundary
  agentTypes: string[]; // Model types that can use this dialect
  expiresAt?: number; // Optional expiration timestamp
}

/**
 * Active dialect between agent pair
 */
export interface ActiveDialect {
  id: string; // Dialect identifier
  scope: DialectScope; // Boundary constraints
  patterns: Map<string, DiscoveredPattern>; // Active patterns
  created: number; // Creation timestamp
  lastActivity: number; // Last usage timestamp
  stats: {
    messagesExchanged: number;
    patternsUsed: number;
    fallbackCount: number; // Times fallen back to base spec
    compressionRatio: number; // Average compression achieved
  };
}

/**
 * Pattern effectiveness tracker
 */
export interface EffectivenessTracker {
  patternId: string;
  measurements: Array<{
    timestamp: number;
    effectiveness: number;
    context: string; // What was being communicated
    outcome: 'success' | 'partial' | 'failure';
  }>;
  averageEffectiveness: number;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Base specification fallback info
 */
export interface FallbackInfo {
  reason: 'unknown_pattern' | 'cross_boundary' | 'error';
  originalPattern?: string; // Pattern that couldn't be used
  timestamp: number;
  agents: {
    sender: SILCAgentID;
    receiver: SILCAgentID;
  };
}

/**
 * Dialect learning progress
 */
export interface LearningProgress {
  dialectId: string;
  patternsLearned: number;
  learningRate: number; // Patterns per hour
  comprehension: number; // 0-1, understanding of dialect
  lastUpdate: number;
}
