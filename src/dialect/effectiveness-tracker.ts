/**
 * Pattern Effectiveness Tracker
 *
 * Tracks the effectiveness of discovered patterns and provides
 * metrics for automatic pattern adoption decisions.
 */

import type {
  DiscoveredPattern,
  EffectivenessTracker as IEffectivenessTracker,
  PatternContext,
} from '../types/dialect.types';
import type { ISILCMessage } from '../types/message.types';
import { EventEmitter } from 'events';

/**
 * Effectiveness tracking events
 */
interface EffectivenessEvents {
  'effectiveness.improved': [string, number]; // patternId, newScore
  'effectiveness.declined': [string, number]; // patternId, newScore
  'effectiveness.stable': [string, number]; // patternId, score
}

/**
 * Communication outcome for effectiveness measurement
 */
export interface CommunicationOutcome {
  patternId: string;
  context: string;
  success: boolean;
  metrics: {
    responseTime: number; // Milliseconds to receive response
    clarity: number; // 0-1, signal clarity/quality
    compression: number; // Bytes saved vs base spec
    retries: number; // Number of retries needed
  };
}

/**
 * Configuration for effectiveness tracking
 */
export interface EffectivenessConfig {
  windowSize: number; // Number of recent measurements to consider
  trendThreshold: number; // Change threshold for trend detection
  decayFactor: number; // Weight decay for older measurements
  minMeasurements: number; // Minimum measurements before evaluation
}

/**
 * Effectiveness Tracker Implementation
 */
export class EffectivenessTracker extends EventEmitter<EffectivenessEvents> {
  private trackers = new Map<string, IEffectivenessTracker>();
  private readonly config: EffectivenessConfig;
  private baselineMetrics = new Map<string, number>();

  constructor(config: Partial<EffectivenessConfig> = {}) {
    super();

    this.config = {
      windowSize: 50,
      trendThreshold: 0.1,
      decayFactor: 0.95,
      minMeasurements: 10,
      ...config,
    };
  }

  /**
   * Track pattern usage and outcome
   */
  trackUsage(
    pattern: DiscoveredPattern,
    outcome: CommunicationOutcome,
    context: PatternContext,
  ): void {
    const tracker = this.getOrCreateTracker(pattern.id);

    // Calculate effectiveness score for this usage
    const effectiveness = this.calculateEffectiveness(outcome);

    // Add measurement with original metrics
    tracker.measurements.push({
      timestamp: Date.now(),
      effectiveness,
      context: outcome.context,
      outcome: this.categorizeOutcome(outcome),
      metrics: outcome.metrics, // Store original metrics
    } as any);

    // Maintain window size
    if (tracker.measurements.length > this.config.windowSize) {
      tracker.measurements.shift();
    }

    // Update average and trend
    this.updateTrackerMetrics(tracker);

    // Emit trend events
    this.emitTrendEvent(pattern.id, tracker);
  }

  /**
   * Compare pattern effectiveness to base specification
   */
  compareToBaseline(patternId: string, baselineTime: number, baselineClarity: number): number {
    const tracker = this.trackers.get(patternId);
    if (!tracker || tracker.measurements.length === 0) {
      return 0;
    }

    // Calculate average metrics for pattern
    const patternMetrics = this.calculateAverageMetrics(tracker);

    // Compare to baseline
    const timeImprovement = (baselineTime - patternMetrics.responseTime) / baselineTime;
    const clarityImprovement = (patternMetrics.clarity - baselineClarity) / baselineClarity;

    // Weighted comparison
    return timeImprovement * 0.6 + clarityImprovement * 0.4;
  }

  /**
   * Get effectiveness score for a pattern
   */
  getEffectiveness(patternId: string): number {
    const tracker = this.trackers.get(patternId);
    return tracker?.averageEffectiveness ?? 0;
  }

  /**
   * Get trend for a pattern
   */
  getTrend(patternId: string): 'improving' | 'stable' | 'declining' | 'unknown' {
    const tracker = this.trackers.get(patternId);
    if (!tracker || tracker.measurements.length < this.config.minMeasurements) {
      return 'unknown';
    }
    return tracker.trend;
  }

  /**
   * Get patterns ranked by effectiveness
   */
  getRankedPatterns(minMeasurements: number = this.config.minMeasurements): Array<{
    patternId: string;
    effectiveness: number;
    trend: string;
    measurements: number;
  }> {
    const ranked: Array<{
      patternId: string;
      effectiveness: number;
      trend: string;
      measurements: number;
    }> = [];

    this.trackers.forEach((tracker, patternId) => {
      if (tracker.measurements.length >= minMeasurements) {
        ranked.push({
          patternId,
          effectiveness: tracker.averageEffectiveness,
          trend: tracker.trend,
          measurements: tracker.measurements.length,
        });
      }
    });

    return ranked.sort((a, b) => b.effectiveness - a.effectiveness);
  }

  /**
   * Should adopt pattern based on effectiveness
   */
  shouldAdopt(patternId: string, threshold: number = 0.7): boolean {
    const tracker = this.trackers.get(patternId);
    if (!tracker || tracker.measurements.length < this.config.minMeasurements) {
      return false;
    }

    // Check effectiveness threshold
    if (tracker.averageEffectiveness < threshold) {
      return false;
    }

    // Check trend - don't adopt declining patterns
    if (tracker.trend === 'declining') {
      return false;
    }

    // Check consistency
    const consistency = this.calculateConsistency(tracker);
    return consistency > 0.6;
  }

  /**
   * Clear tracking data for a pattern
   */
  clearPattern(patternId: string): void {
    this.trackers.delete(patternId);
    this.baselineMetrics.delete(patternId);
  }

  /**
   * Get or create tracker for pattern
   */
  private getOrCreateTracker(patternId: string): IEffectivenessTracker {
    let tracker = this.trackers.get(patternId);
    if (!tracker) {
      tracker = {
        patternId,
        measurements: [],
        averageEffectiveness: 0,
        trend: 'stable',
      };
      this.trackers.set(patternId, tracker);
    }
    return tracker;
  }

  /**
   * Calculate effectiveness score from outcome
   */
  private calculateEffectiveness(outcome: CommunicationOutcome): number {
    const { success, metrics } = outcome;

    if (!success) {
      return 0;
    }

    // Response time score (faster is better, normalized to 0-1)
    const timeScore = Math.max(0, 1 - metrics.responseTime / 1000);

    // Clarity score (already 0-1)
    const clarityScore = metrics.clarity;

    // Compression score (more compression is better)
    const compressionScore = Math.min(1, metrics.compression / 100);

    // Retry penalty
    const retryPenalty = Math.max(0, 1 - metrics.retries * 0.2);

    // Weighted average
    return timeScore * 0.3 + clarityScore * 0.4 + compressionScore * 0.2 + retryPenalty * 0.1;
  }

  /**
   * Categorize communication outcome
   */
  private categorizeOutcome(outcome: CommunicationOutcome): 'success' | 'partial' | 'failure' {
    if (!outcome.success) {
      return 'failure';
    }

    if (outcome.metrics.retries > 0 || outcome.metrics.clarity < 0.7) {
      return 'partial';
    }

    return 'success';
  }

  /**
   * Update tracker metrics
   */
  private updateTrackerMetrics(tracker: IEffectivenessTracker): void {
    if (tracker.measurements.length === 0) {
      return;
    }

    // Calculate weighted average with decay
    let totalWeight = 0;
    let weightedSum = 0;

    tracker.measurements.forEach((measurement, index) => {
      const age = tracker.measurements.length - index - 1;
      const weight = Math.pow(this.config.decayFactor, age);
      totalWeight += weight;
      weightedSum += measurement.effectiveness * weight;
    });

    tracker.averageEffectiveness = weightedSum / totalWeight;

    // Detect trend
    tracker.trend = this.detectTrend(tracker);
  }

  /**
   * Detect effectiveness trend
   */
  private detectTrend(tracker: IEffectivenessTracker): 'improving' | 'stable' | 'declining' {
    if (tracker.measurements.length < this.config.minMeasurements) {
      return 'stable';
    }

    // Compare recent vs older measurements
    const halfPoint = Math.floor(tracker.measurements.length / 2);
    const older = tracker.measurements.slice(0, halfPoint);
    const recent = tracker.measurements.slice(halfPoint);

    const olderAvg = older.reduce((sum, m) => sum + m.effectiveness, 0) / older.length;
    const recentAvg = recent.reduce((sum, m) => sum + m.effectiveness, 0) / recent.length;

    const change = recentAvg - olderAvg;

    if (Math.abs(change) < this.config.trendThreshold) {
      return 'stable';
    }

    return change > 0 ? 'improving' : 'declining';
  }

  /**
   * Calculate average metrics for pattern
   */
  private calculateAverageMetrics(tracker: IEffectivenessTracker): {
    responseTime: number;
    clarity: number;
  } {
    if (tracker.measurements.length === 0) {
      return { responseTime: 0, clarity: 0 };
    }

    // Calculate averages from stored metrics
    const totalResponseTime = tracker.measurements.reduce((sum, m) => 
      sum + ((m as any).metrics?.responseTime || 0), 0);
    const totalClarity = tracker.measurements.reduce((sum, m) => 
      sum + ((m as any).metrics?.clarity || 0), 0);

    return {
      responseTime: totalResponseTime / tracker.measurements.length,
      clarity: totalClarity / tracker.measurements.length,
    };
  }

  /**
   * Calculate consistency of pattern effectiveness
   */
  private calculateConsistency(tracker: IEffectivenessTracker): number {
    if (tracker.measurements.length < 2) {
      return 1;
    }

    // Calculate variance
    const mean = tracker.averageEffectiveness;
    const variance =
      tracker.measurements.reduce((sum, m) => {
        return sum + Math.pow(m.effectiveness - mean, 2);
      }, 0) / tracker.measurements.length;

    // Convert to consistency score (lower variance = higher consistency)
    return 1 / (1 + variance);
  }

  /**
   * Emit trend event based on tracker state
   */
  private emitTrendEvent(patternId: string, tracker: IEffectivenessTracker): void {
    const previousTrend = this.getPreviousTrend(patternId);

    if (previousTrend && previousTrend !== tracker.trend) {
      switch (tracker.trend) {
        case 'improving':
          this.emit('effectiveness.improved', patternId, tracker.averageEffectiveness);
          break;
        case 'declining':
          this.emit('effectiveness.declined', patternId, tracker.averageEffectiveness);
          break;
        case 'stable':
          this.emit('effectiveness.stable', patternId, tracker.averageEffectiveness);
          break;
      }
    }

    this.setPreviousTrend(patternId, tracker.trend);
  }

  private previousTrends = new Map<string, string>();

  /**
   * Get previous trend for pattern
   */
  private getPreviousTrend(patternId: string): string | undefined {
    return this.previousTrends.get(patternId);
  }

  /**
   * Set previous trend for pattern
   */
  private setPreviousTrend(patternId: string, trend: string): void {
    this.previousTrends.set(patternId, trend);
  }
}
