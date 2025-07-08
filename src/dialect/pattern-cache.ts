/**
 * Pattern Cache System
 * 
 * High-performance in-memory cache for signal patterns ("phonemes")
 * that enables fast dialect communication without database hits.
 */

import type { ISILCSignal, SILCAgentID } from '../types/message.types';
import type { DiscoveredPattern } from '../types/dialect.types';

/**
 * Signal phoneme - atomic building block of patterns
 */
export interface SignalPhoneme {
  id: string;                    // Unique phoneme identifier
  signal: ISILCSignal;           // The signal pattern
  frequency: number;             // How often it appears
  contexts: string[];            // Where it's used (domains)
  lastUsed: number;              // LRU eviction
  compressionRatio: number;      // Bytes saved vs full signal
}

/**
 * Pattern reference for fast lookup
 */
export interface PatternReference {
  id: string;
  phonemeSequence: string[];     // Sequence of phoneme IDs
  dialectId: string;
  effectiveness: number;
  useCount: number;
  lastAccessed: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hotPatterns: number;
  phonemes: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressionRatio: number;
}

/**
 * High-performance pattern cache
 */
export class PatternCache {
  private hotPatterns = new Map<string, DiscoveredPattern>();
  private phonemeCache = new Map<string, SignalPhoneme>();
  private patternIndex = new Map<string, PatternReference>();
  private accessHistory = new Map<string, number>();
  
  private stats: CacheStats = {
    hotPatterns: 0,
    phonemes: 0,
    hitRate: 0,
    missRate: 0,
    evictions: 0,
    compressionRatio: 0
  };
  
  private hits = 0;
  private misses = 0;
  private maxHotPatterns = 1000;
  private maxPhonemes = 10000;

  /**
   * Get pattern by ID (hot path - must be fast)
   */
  getPattern(patternId: string): DiscoveredPattern | null {
    // Check hot cache first
    const hotPattern = this.hotPatterns.get(patternId);
    if (hotPattern) {
      this.recordHit(patternId);
      return hotPattern;
    }

    // Check if we can reconstruct from phonemes
    const patternRef = this.patternIndex.get(patternId);
    if (patternRef) {
      const reconstructed = this.reconstructPattern(patternRef);
      if (reconstructed) {
        // Promote to hot cache
        this.promoteToHot(patternId, reconstructed);
        this.recordHit(patternId);
        return reconstructed;
      }
    }

    this.recordMiss(patternId);
    return null;
  }

  /**
   * Store pattern in cache
   */
  setPattern(pattern: DiscoveredPattern): void {
    // Break down into phonemes
    const phonemes = this.extractPhonemes(pattern);
    
    // Store phonemes
    phonemes.forEach(phoneme => {
      this.storePhoneme(phoneme);
    });

    // Create pattern reference
    const patternRef: PatternReference = {
      id: pattern.id,
      phonemeSequence: phonemes.map(p => p.id),
      dialectId: this.extractDialectId(pattern),
      effectiveness: pattern.effectiveness,
      useCount: 0,
      lastAccessed: Date.now()
    };
    
    this.patternIndex.set(pattern.id, patternRef);

    // Add to hot cache if there's room
    if (this.hotPatterns.size < this.maxHotPatterns) {
      this.hotPatterns.set(pattern.id, pattern);
    }
    
    this.updateStats();
  }

  /**
   * Get phoneme by signal characteristics
   */
  findPhoneme(signal: ISILCSignal): SignalPhoneme | null {
    const phonemeId = this.generatePhonemeId(signal);
    return this.phonemeCache.get(phonemeId) || null;
  }

  /**
   * Pre-warm cache with common patterns
   */
  preWarm(patterns: DiscoveredPattern[]): void {
    patterns.forEach(pattern => {
      this.setPattern(pattern);
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.hotPatterns.clear();
    this.phonemeCache.clear();
    this.patternIndex.clear();
    this.accessHistory.clear();
    this.hits = 0;
    this.misses = 0;
    this.updateStats();
  }

  /**
   * Extract phonemes from pattern
   */
  private extractPhonemes(pattern: DiscoveredPattern): SignalPhoneme[] {
    const phonemes: SignalPhoneme[] = [];
    
    pattern.signals.forEach((signal, index) => {
      const phonemeId = this.generatePhonemeId(signal);
      
      // Check if phoneme already exists
      const existing = this.phonemeCache.get(phonemeId);
      if (existing) {
        existing.frequency++;
        existing.lastUsed = Date.now();
        phonemes.push(existing);
      } else {
        // Create new phoneme
        const phoneme: SignalPhoneme = {
          id: phonemeId,
          signal,
          frequency: 1,
          contexts: [this.extractDialectId(pattern)],
          lastUsed: Date.now(),
          compressionRatio: this.calculateCompressionRatio(signal)
        };
        phonemes.push(phoneme);
      }
    });
    
    return phonemes;
  }

  /**
   * Store phoneme in cache
   */
  private storePhoneme(phoneme: SignalPhoneme): void {
    // Check if cache is full
    if (this.phonemeCache.size >= this.maxPhonemes) {
      this.evictLeastUsedPhoneme();
    }
    
    this.phonemeCache.set(phoneme.id, phoneme);
  }

  /**
   * Generate phoneme ID from signal
   */
  private generatePhonemeId(signal: ISILCSignal): string {
    // Create deterministic ID based on signal characteristics
    const amp = Math.round(signal.amplitude * 100) / 100;
    const freq = signal.frequency;
    const phase = Math.round(signal.phase * 100) / 100;
    const harmonics = signal.harmonics?.map(h => Math.round(h * 1000) / 1000).join(':') || '';
    
    return `${amp}_${freq}_${phase}_${harmonics}`;
  }

  /**
   * Reconstruct pattern from phoneme references
   */
  private reconstructPattern(patternRef: PatternReference): DiscoveredPattern | null {
    const signals: ISILCSignal[] = [];
    
    // Get all phonemes
    for (const phonemeId of patternRef.phonemeSequence) {
      const phoneme = this.phonemeCache.get(phonemeId);
      if (!phoneme) {
        return null; // Can't reconstruct if phoneme is missing
      }
      signals.push(phoneme.signal);
    }
    
    // Reconstruct pattern
    const pattern: DiscoveredPattern = {
      id: patternRef.id,
      signals,
      metadata: {
        occurrences: patternRef.useCount,
        firstSeen: 0, // Would need to store this
        lastSeen: patternRef.lastAccessed,
        contexts: {} // Would need to reconstruct from phoneme contexts
      },
      effectiveness: patternRef.effectiveness,
      adoptionRate: 0 // Would need to calculate
    };
    
    return pattern;
  }

  /**
   * Promote pattern to hot cache
   */
  private promoteToHot(patternId: string, pattern: DiscoveredPattern): void {
    // If hot cache is full, evict least recently used
    if (this.hotPatterns.size >= this.maxHotPatterns) {
      this.evictLeastUsedPattern();
    }
    
    this.hotPatterns.set(patternId, pattern);
  }

  /**
   * Evict least recently used pattern
   */
  private evictLeastUsedPattern(): void {
    let oldestAccess = Date.now();
    let oldestPattern = '';
    
    this.accessHistory.forEach((lastAccess, patternId) => {
      if (lastAccess < oldestAccess) {
        oldestAccess = lastAccess;
        oldestPattern = patternId;
      }
    });
    
    if (oldestPattern) {
      this.hotPatterns.delete(oldestPattern);
      this.accessHistory.delete(oldestPattern);
      this.stats.evictions++;
    }
  }

  /**
   * Evict least used phoneme
   */
  private evictLeastUsedPhoneme(): void {
    let oldestPhoneme = '';
    let oldestTime = Date.now();
    
    this.phonemeCache.forEach((phoneme, id) => {
      if (phoneme.lastUsed < oldestTime) {
        oldestTime = phoneme.lastUsed;
        oldestPhoneme = id;
      }
    });
    
    if (oldestPhoneme) {
      this.phonemeCache.delete(oldestPhoneme);
      this.stats.evictions++;
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(patternId: string): void {
    this.hits++;
    this.accessHistory.set(patternId, Date.now());
    
    // Update pattern reference
    const patternRef = this.patternIndex.get(patternId);
    if (patternRef) {
      patternRef.useCount++;
      patternRef.lastAccessed = Date.now();
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(patternId: string): void {
    this.misses++;
  }

  /**
   * Extract dialect ID from pattern
   */
  private extractDialectId(pattern: DiscoveredPattern): string {
    // This would extract from pattern metadata
    return 'default';
  }

  /**
   * Calculate compression ratio for signal
   */
  private calculateCompressionRatio(signal: ISILCSignal): number {
    const fullSize = JSON.stringify(signal).length;
    const compressedSize = 16; // Phoneme ID size
    return 1 - (compressedSize / fullSize);
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.hotPatterns = this.hotPatterns.size;
    this.stats.phonemes = this.phonemeCache.size;
    
    const total = this.hits + this.misses;
    if (total > 0) {
      this.stats.hitRate = this.hits / total;
      this.stats.missRate = this.misses / total;
    } else {
      this.stats.hitRate = 0;
      this.stats.missRate = 0;
    }
    
    // Calculate average compression ratio
    let totalCompression = 0;
    this.phonemeCache.forEach(phoneme => {
      totalCompression += phoneme.compressionRatio;
    });
    
    this.stats.compressionRatio = this.phonemeCache.size > 0 
      ? totalCompression / this.phonemeCache.size 
      : 0;
  }
}