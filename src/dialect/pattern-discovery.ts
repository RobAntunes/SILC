/**
 * Pattern Discovery Engine
 *
 * Analyzes signal patterns to discover emerging communication patterns
 * through continuous observation and statistical analysis.
 */

import type { ISILCMessage, ISILCSignal, SILCAgentID } from '../types/message.types';
import type { DiscoveredPattern, PatternMetrics } from '../types/dialect.types';
import { EventEmitter } from 'events';

/**
 * Pattern discovery events
 */
interface PatternDiscoveryEvents {
  'pattern.discovered': [DiscoveredPattern];
  'pattern.confirmed': [DiscoveredPattern];
  'pattern.rejected': [string, string]; // patternId, reason
}

/**
 * Signal sequence for pattern matching
 */
interface SignalSequence {
  signals: ISILCSignal[];
  context: {
    senderId: SILCAgentID;
    receiverId: SILCAgentID;
    timestamp: number;
    messageType: string;
  };
}

/**
 * Pattern candidate being analyzed
 */
interface PatternCandidate {
  id: string;
  sequence: ISILCSignal[];
  occurrences: number;
  contexts: SignalSequence['context'][];
  metrics: PatternMetrics;
  firstSeen: number;
  lastSeen: number;
}

/**
 * Configuration for pattern discovery
 */
export interface PatternDiscoveryConfig {
  windowSize: number; // Number of recent signals to analyze
  minOccurrences: number; // Minimum occurrences to consider a pattern
  confidenceThreshold: number; // Minimum confidence to confirm pattern
  maxCandidates: number; // Maximum number of pattern candidates to track
  analysisInterval: number; // Milliseconds between analysis runs
}

/**
 * Pattern Discovery Engine
 */
export class PatternDiscovery extends EventEmitter<PatternDiscoveryEvents> {
  private signalBuffer: SignalSequence[] = [];
  private patternCandidates = new Map<string, PatternCandidate>();
  private confirmedPatterns = new Map<string, DiscoveredPattern>();
  private analysisTimer?: NodeJS.Timeout;
  private readonly config: PatternDiscoveryConfig;

  constructor(config: Partial<PatternDiscoveryConfig> = {}) {
    super();

    this.config = {
      windowSize: 1000,
      minOccurrences: 5,
      confidenceThreshold: 0.8,
      maxCandidates: 100,
      analysisInterval: 5000,
      ...config,
    };
  }

  /**
   * Start pattern discovery
   */
  start(): void {
    if (this.analysisTimer) {
      return;
    }

    this.analysisTimer = setInterval(() => {
      this.analyzePatterns();
    }, this.config.analysisInterval);
  }

  /**
   * Stop pattern discovery
   */
  stop(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = undefined;
    }
  }

  /**
   * Observe a message for pattern discovery
   */
  observe(message: ISILCMessage): void {
    if (!message.signals || message.signals.length === 0) {
      return;
    }

    const sequence: SignalSequence = {
      signals: message.signals,
      context: {
        senderId: message.header.senderId,
        receiverId: message.header.receiverId,
        timestamp: message.header.timestamp,
        messageType: message.header.messageType,
      },
    };

    // Add to buffer with sliding window
    this.signalBuffer.push(sequence);
    if (this.signalBuffer.length > this.config.windowSize) {
      this.signalBuffer.shift();
    }

    // Extract patterns from the new sequence
    this.extractPatterns(sequence);
    
    // Trigger immediate analysis if not running timer (for tests)
    if (!this.analysisTimer) {
      this.analyzePatterns();
    }
  }

  /**
   * Extract potential patterns from a signal sequence
   */
  private extractPatterns(sequence: SignalSequence): void {
    const { signals } = sequence;

    // Only create patterns from sequences with multiple signals
    if (signals.length < 2) {
      return;
    }

    // Look for patterns of various lengths (2-5 signals)
    for (let length = 2; length <= Math.min(5, signals.length); length++) {
      for (let start = 0; start <= signals.length - length; start++) {
        const pattern = signals.slice(start, start + length);
        const patternId = this.generatePatternId(pattern);

        // Update or create pattern candidate
        const candidate = this.patternCandidates.get(patternId);
        if (candidate) {
          candidate.occurrences++;
          candidate.contexts.push(sequence.context);
          candidate.lastSeen = Date.now();
          this.updatePatternMetrics(candidate);
        } else if (this.patternCandidates.size < this.config.maxCandidates) {
          this.patternCandidates.set(patternId, {
            id: patternId,
            sequence: pattern,
            occurrences: 1,
            contexts: [sequence.context],
            metrics: this.initializeMetrics(),
            firstSeen: Date.now(),
            lastSeen: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Analyze patterns for confirmation
   */
  analyzePatterns(): void {
    const now = Date.now();
    const confirmed: DiscoveredPattern[] = [];
    const rejected: Array<[string, string]> = [];

    // Analyze each candidate
    this.patternCandidates.forEach((candidate, patternId) => {
      // Check if pattern meets criteria
      if (candidate.occurrences >= this.config.minOccurrences) {
        const confidence = this.calculateConfidence(candidate);

        if (confidence >= this.config.confidenceThreshold) {
          // Confirm pattern
          const pattern: DiscoveredPattern = {
            id: patternId,
            signals: candidate.sequence,
            metadata: {
              occurrences: candidate.occurrences,
              firstSeen: candidate.firstSeen,
              lastSeen: candidate.lastSeen,
              contexts: this.summarizeContexts(candidate.contexts),
            },
            effectiveness: candidate.metrics.effectiveness,
            adoptionRate: candidate.metrics.adoptionRate,
          };

          this.confirmedPatterns.set(patternId, pattern);
          confirmed.push(pattern);
          this.patternCandidates.delete(patternId);
        }
      }

      // Remove stale candidates
      const age = now - candidate.lastSeen;
      if (age > 60000 && candidate.occurrences < 3) {
        // 1 minute with < 3 occurrences
        rejected.push([patternId, 'Insufficient activity']);
        this.patternCandidates.delete(patternId);
      }
    });

    // Emit events
    confirmed.forEach((pattern) => {
      this.emit('pattern.discovered', pattern);
    });

    rejected.forEach(([id, reason]) => {
      this.emit('pattern.rejected', id, reason);
    });
  }

  /**
   * Generate unique ID for a pattern
   */
  private generatePatternId(signals: ISILCSignal[]): string {
    // Create a deterministic ID based on signal properties
    const components = signals.map((signal) => {
      const amp = Math.round(signal.amplitude * 10) / 10;
      const freq = signal.frequency;
      const phase = signal.phase;
      const harmonics = signal.harmonics?.join(':') || '';
      return `${amp}-${freq}-${phase}-${harmonics}`;
    });
    return components.join('|');
  }

  /**
   * Initialize pattern metrics
   */
  private initializeMetrics(): PatternMetrics {
    return {
      effectiveness: 0,
      efficiency: 0,
      accuracy: 0,
      adoptionRate: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Update pattern metrics based on observations
   */
  private updatePatternMetrics(candidate: PatternCandidate): void {
    const { contexts, occurrences } = candidate;
    const timeSpan = candidate.lastSeen - candidate.firstSeen;

    // Calculate adoption rate (occurrences per time unit)
    const hoursElapsed = Math.max(1, timeSpan / (1000 * 60 * 60));
    candidate.metrics.adoptionRate = occurrences / hoursElapsed;

    // Calculate effectiveness based on signal strength patterns
    const avgAmplitude =
      candidate.sequence.reduce((sum, signal) => sum + signal.amplitude, 0) /
      candidate.sequence.length;
    candidate.metrics.effectiveness = avgAmplitude;

    // Calculate efficiency (pattern length vs information density)
    const patternLength = candidate.sequence.length;
    const uniqueFrequencies = new Set(candidate.sequence.map((s) => s.frequency)).size;
    candidate.metrics.efficiency = uniqueFrequencies / patternLength;

    // Accuracy is based on pattern consistency
    candidate.metrics.accuracy = this.calculatePatternConsistency(candidate);

    candidate.metrics.lastUpdated = Date.now();
  }

  /**
   * Calculate confidence score for a pattern
   */
  private calculateConfidence(candidate: PatternCandidate): number {
    const occurrenceScore = Math.min(1, candidate.occurrences / 20);
    const adoptionScore = Math.min(1, candidate.metrics.adoptionRate / 10);
    const effectivenessScore = candidate.metrics.effectiveness;
    const consistencyScore = candidate.metrics.accuracy;

    // Weighted average
    return (
      occurrenceScore * 0.3 +
      adoptionScore * 0.2 +
      effectivenessScore * 0.3 +
      consistencyScore * 0.2
    );
  }

  /**
   * Calculate pattern consistency
   */
  private calculatePatternConsistency(candidate: PatternCandidate): number {
    if (candidate.contexts.length < 2) {
      return 1.0;
    }

    // Check consistency of context (same agent pairs, similar timing)
    const agentPairs = candidate.contexts.map(
      (ctx) => `${ctx.senderId.instanceId}-${ctx.receiverId.instanceId}`,
    );
    const uniquePairs = new Set(agentPairs).size;
    const pairConsistency = 1 / uniquePairs;

    // Check timing consistency
    const intervals: number[] = [];
    for (let i = 1; i < candidate.contexts.length; i++) {
      intervals.push(candidate.contexts[i].timestamp - candidate.contexts[i - 1].timestamp);
    }

    if (intervals.length === 0) {
      return pairConsistency;
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;

    const timingConsistency = 1 / (1 + variance / (avgInterval * avgInterval));

    return (pairConsistency + timingConsistency) / 2;
  }

  /**
   * Summarize contexts for a pattern
   */
  private summarizeContexts(contexts: SignalSequence['context'][]): any {
    const agentPairs = new Map<string, number>();
    const messageTypes = new Map<string, number>();

    contexts.forEach((ctx) => {
      const pairKey = `${ctx.senderId.namespace}/${ctx.senderId.modelType} -> ${ctx.receiverId.namespace}/${ctx.receiverId.modelType}`;
      agentPairs.set(pairKey, (agentPairs.get(pairKey) || 0) + 1);
      messageTypes.set(ctx.messageType, (messageTypes.get(ctx.messageType) || 0) + 1);
    });

    return {
      totalOccurrences: contexts.length,
      agentPairs: Object.fromEntries(agentPairs),
      messageTypes: Object.fromEntries(messageTypes),
      timeRange: {
        first: contexts[0]?.timestamp,
        last: contexts[contexts.length - 1]?.timestamp,
      },
    };
  }

  /**
   * Get discovered patterns
   */
  getDiscoveredPatterns(): DiscoveredPattern[] {
    return Array.from(this.confirmedPatterns.values());
  }

  /**
   * Get pattern candidates
   */
  getPatternCandidates(): PatternCandidate[] {
    return Array.from(this.patternCandidates.values());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.signalBuffer = [];
    this.patternCandidates.clear();
    this.confirmedPatterns.clear();
  }
}
