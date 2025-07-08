/**
 * Dialect Manager
 *
 * Manages dialects created by AI models during communication.
 * Dialects are self-interpreting patterns that emerge organically.
 */

import type { ISILCMessage, ISILCSignal, SILCAgentID } from '../types/message.types';
import type {
  ActiveDialect,
  DialectScope,
  DiscoveredPattern,
  FallbackInfo,
} from '../types/dialect.types';
import { PatternDiscovery } from './pattern-discovery';
import { EffectivenessTracker } from './effectiveness-tracker';
import { SignalValidator } from '../signal/validator';
import { PatternCache } from './pattern-cache';
import { EventEmitter } from 'events';

/**
 * Dialect manager events
 */
interface DialectManagerEvents {
  'dialect.created': [ActiveDialect];
  'dialect.updated': [ActiveDialect];
  'dialect.expired': [string]; // dialectId
  'fallback.used': [FallbackInfo];
}

/**
 * Dialect manager configuration
 */
export interface DialectManagerConfig {
  instanceId: string; // Program instance boundary
  maxDialectsPerPair: number; // Max dialects between agent pair
  dialectTTL: number; // Time to live in milliseconds
  enableDiscovery: boolean; // Enable pattern discovery
}

/**
 * Dialect Manager Implementation
 */
export class DialectManager extends EventEmitter<DialectManagerEvents> {
  private activeDialects = new Map<string, ActiveDialect>();
  private patternDiscovery: PatternDiscovery;
  private effectivenessTracker: EffectivenessTracker;
  private signalValidator: SignalValidator;
  private patternCache: PatternCache;
  private readonly config: DialectManagerConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<DialectManagerConfig> = {}) {
    super();

    this.config = {
      instanceId: crypto.randomUUID(),
      maxDialectsPerPair: 10,
      dialectTTL: 24 * 60 * 60 * 1000, // 24 hours
      enableDiscovery: true,
      ...config,
    };

    // Initialize components
    this.patternDiscovery = new PatternDiscovery();
    this.effectivenessTracker = new EffectivenessTracker();
    this.signalValidator = new SignalValidator();
    this.patternCache = new PatternCache();

    // Start pattern discovery if enabled
    if (this.config.enableDiscovery) {
      this.patternDiscovery.start();
      this.setupDiscoveryHandlers();
    }

    // Cleanup expired dialects periodically
    this.cleanupTimer = setInterval(() => this.cleanupExpiredDialects(), 60000); // Every minute
  }

  /**
   * Process a message and handle dialect patterns
   */
  async processMessage(
    message: ISILCMessage,
    direction: 'sent' | 'received',
  ): Promise<ISILCMessage> {
    const agentPair = this.getAgentPairKey(message.header.senderId, message.header.receiverId);

    // Get or create dialect for this agent pair
    let dialect = this.getDialectForPair(agentPair);
    if (!dialect) {
      dialect = this.createDialect(agentPair, [
        message.header.senderId.modelType,
        message.header.receiverId.modelType,
      ]);
    }

    // Update dialect activity
    dialect.lastActivity = Date.now();
    dialect.stats.messagesExchanged++;

    // Let pattern discovery observe the message
    if (this.config.enableDiscovery) {
      this.patternDiscovery.observe(message);
    }

    // Process signals for dialect patterns
    const processedMessage = await this.processSignals(message, dialect);

    return processedMessage;
  }

  /**
   * Get patterns for a specific dialect
   */
  getDialectPatterns(dialectId: string): DiscoveredPattern[] {
    const dialect = this.activeDialects.get(dialectId);
    if (!dialect) {
      return [];
    }
    return Array.from(dialect.patterns.values());
  }

  /**
   * Fallback to base specification
   */
  fallbackToBase(message: ISILCMessage, reason: FallbackInfo['reason']): ISILCMessage {
    const fallbackInfo: FallbackInfo = {
      reason,
      timestamp: Date.now(),
      agents: {
        sender: message.header.senderId,
        receiver: message.header.receiverId,
      },
    };

    this.emit('fallback.used', fallbackInfo);

    // Update dialect stats
    const agentPair = this.getAgentPairKey(message.header.senderId, message.header.receiverId);
    const dialect = this.getDialectForPair(agentPair);
    if (dialect) {
      dialect.stats.fallbackCount++;
    }

    // Return message as-is (base spec)
    return message;
  }

  /**
   * Check if agents can use dialect (same instance boundary)
   */
  canUseDialect(sender: SILCAgentID, receiver: SILCAgentID, dialectId: string): boolean {
    const dialect = this.activeDialects.get(dialectId);
    if (!dialect) {
      return false;
    }

    // Check instance boundary
    if (dialect.scope.instanceId !== this.config.instanceId) {
      return false;
    }

    // Check agent types
    const senderAllowed = dialect.scope.agentTypes.includes(sender.modelType);
    const receiverAllowed = dialect.scope.agentTypes.includes(receiver.modelType);

    return senderAllowed && receiverAllowed;
  }

  /**
   * Setup pattern discovery event handlers
   */
  private setupDiscoveryHandlers(): void {
    // Handle newly discovered patterns
    this.patternDiscovery.on('pattern.discovered', (pattern) => {
      // Add pattern to relevant dialects
      this.activeDialects.forEach((dialect) => {
        // Check if pattern is relevant to this dialect
        if (this.isPatternRelevant(pattern, dialect)) {
          dialect.patterns.set(pattern.id, pattern);
          dialect.stats.patternsUsed++;
          this.emit('dialect.updated', dialect);
        }
      });
    });

    // Handle pattern effectiveness updates
    this.effectivenessTracker.on('effectiveness.improved', (patternId, score) => {
      // Update pattern score in dialects
      this.activeDialects.forEach((dialect) => {
        const pattern = dialect.patterns.get(patternId);
        if (pattern) {
          pattern.effectiveness = score;
        }
      });
    });
  }

  /**
   * Process signals for dialect patterns
   */
  private async processSignals(
    message: ISILCMessage,
    dialect: ActiveDialect,
  ): Promise<ISILCMessage> {
    // Fast cache lookup for patterns
    const messageSignature = this.generateMessageSignature(message.signals);
    const cachedPattern = this.patternCache.getPattern(messageSignature);
    
    if (cachedPattern) {
      // Fast path - pattern found in cache
      dialect.stats.patternsUsed++;
      
      // Calculate compression using cached ratio
      const originalSize = JSON.stringify(message).length;
      const patternSize = cachedPattern.id.length + 10;
      const compressionRatio = 1 - patternSize / originalSize;
      
      // Update rolling average
      dialect.stats.compressionRatio =
        (dialect.stats.compressionRatio * (dialect.stats.messagesExchanged - 1) +
         compressionRatio) /
        dialect.stats.messagesExchanged;
      
      return message;
    }

    // Fallback to slower pattern matching
    for (const pattern of dialect.patterns.values()) {
      if (this.matchesPattern(message.signals, pattern)) {
        // Track pattern usage
        dialect.stats.patternsUsed++;
        
        // Add to cache for future fast lookups
        this.patternCache.setPattern(pattern);

        // Calculate compression ratio
        const originalSize = JSON.stringify(message).length;
        const patternSize = pattern.id.length + 10;
        const compressionRatio = 1 - patternSize / originalSize;

        // Update rolling average
        dialect.stats.compressionRatio =
          (dialect.stats.compressionRatio * (dialect.stats.messagesExchanged - 1) +
            compressionRatio) /
          dialect.stats.messagesExchanged;

        break;
      }
    }

    return message;
  }

  /**
   * Check if signals match a pattern
   */
  private matchesPattern(signals: ISILCSignal[], pattern: DiscoveredPattern): boolean {
    if (signals.length !== pattern.signals.length) {
      return false;
    }

    // Check if signals match with some tolerance
    return signals.every((signal, index) => {
      const patternSignal = pattern.signals[index];
      return (
        Math.abs(signal.amplitude - patternSignal.amplitude) < 0.1 &&
        signal.frequency === patternSignal.frequency &&
        signal.phase === patternSignal.phase
      );
    });
  }

  /**
   * Check if pattern is relevant to dialect
   */
  private isPatternRelevant(pattern: DiscoveredPattern, dialect: ActiveDialect): boolean {
    // Check if pattern was discovered within this dialect's scope
    const contexts = pattern.metadata.contexts;
    if (!contexts || !contexts.agentPairs) {
      return false;
    }

    // Check if any agent pairs match the dialect's agent types
    const dialectTypes = new Set(dialect.scope.agentTypes);
    for (const pairKey of Object.keys(contexts.agentPairs)) {
      const [senderType, receiverType] = this.parseAgentPairKey(pairKey);
      if (dialectTypes.has(senderType) && dialectTypes.has(receiverType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a new dialect
   */
  private createDialect(agentPairKey: string, agentTypes: string[]): ActiveDialect {
    const dialectId = `dialect-${agentPairKey}-${Date.now()}`;

    const dialect: ActiveDialect = {
      id: dialectId,
      scope: {
        instanceId: this.config.instanceId,
        agentTypes: [...new Set(agentTypes)],
        expiresAt: Date.now() + this.config.dialectTTL,
      },
      patterns: new Map(),
      created: Date.now(),
      lastActivity: Date.now(),
      stats: {
        messagesExchanged: 0,
        patternsUsed: 0,
        fallbackCount: 0,
        compressionRatio: 0,
      },
    };

    this.activeDialects.set(dialectId, dialect);
    this.emit('dialect.created', dialect);

    return dialect;
  }

  /**
   * Get dialect for agent pair
   */
  private getDialectForPair(agentPairKey: string): ActiveDialect | undefined {
    // Find most recent active dialect for this pair
    let mostRecent: ActiveDialect | undefined;

    this.activeDialects.forEach((dialect) => {
      if (dialect.id.includes(agentPairKey)) {
        if (!mostRecent || dialect.lastActivity > mostRecent.lastActivity) {
          mostRecent = dialect;
        }
      }
    });

    return mostRecent;
  }

  /**
   * Get agent pair key
   */
  private getAgentPairKey(sender: SILCAgentID, receiver: SILCAgentID): string {
    // Sort to ensure consistent key regardless of direction
    const ids = [
      `${sender.namespace}:${sender.instanceId}`,
      `${receiver.namespace}:${receiver.instanceId}`,
    ].sort();
    return ids.join('-');
  }

  /**
   * Parse agent pair key
   */
  private parseAgentPairKey(pairKey: string): [string, string] {
    // Extract model types from pair key format
    const parts = pairKey.split(' -> ');
    if (parts.length !== 2) {
      return ['unknown', 'unknown'];
    }

    const senderType = parts[0].split('/')[1] || 'unknown';
    const receiverType = parts[1].split('/')[1] || 'unknown';

    return [senderType, receiverType];
  }

  /**
   * Cleanup expired dialects
   */
  private cleanupExpiredDialects(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.activeDialects.forEach((dialect, id) => {
      if (dialect.scope.expiresAt && dialect.scope.expiresAt < now) {
        expired.push(id);
      }
    });

    expired.forEach((id) => {
      this.activeDialects.delete(id);
      this.emit('dialect.expired', id);
    });
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return this.patternCache.getStats();
  }

  /**
   * Pre-warm cache with common patterns
   */
  preWarmCache(patterns: DiscoveredPattern[]): void {
    this.patternCache.preWarm(patterns);
  }

  /**
   * Generate message signature for caching
   */
  private generateMessageSignature(signals: ISILCSignal[]): string {
    return signals.map(signal => {
      const amp = Math.round(signal.amplitude * 100) / 100;
      const freq = signal.frequency;
      const phase = Math.round(signal.phase * 100) / 100;
      const harmonics = signal.harmonics?.join(':') || '';
      return `${amp}_${freq}_${phase}_${harmonics}`;
    }).join('|');
  }

  /**
   * Shutdown dialect manager
   */
  shutdown(): void {
    this.patternDiscovery.stop();
    this.activeDialects.clear();
    this.patternCache.clear();
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
