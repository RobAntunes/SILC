/**
 * Pattern Persistence System
 * 
 * Background persistence for patterns without blocking real-time communication.
 * Uses async queues and batching to minimize performance impact.
 */

import type { DiscoveredPattern } from '../types/dialect.types';
import type { SignalPhoneme } from './pattern-cache';
import { EventEmitter } from 'events';

/**
 * Persistence operation types
 */
type PersistenceOperation = 
  | { type: 'store_pattern'; pattern: DiscoveredPattern }
  | { type: 'update_pattern'; patternId: string; updates: Partial<DiscoveredPattern> }
  | { type: 'store_phoneme'; phoneme: SignalPhoneme }
  | { type: 'batch_update'; operations: PersistenceOperation[] };

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  batchSize: number;           // Operations to batch together
  flushInterval: number;       // Milliseconds between flushes
  maxQueueSize: number;        // Max operations in queue
  enableCompression: boolean;   // Compress stored data
  storageType: 'memory' | 'file' | 'database';
}

/**
 * Persistence events
 */
interface PersistenceEvents {
  'batch.flushed': [number]; // number of operations flushed
  'error': [Error];
  'storage.full': [number]; // queue size when full
}

/**
 * Background Pattern Persistence
 */
export class PatternPersistence extends EventEmitter<PersistenceEvents> {
  private operationQueue: PersistenceOperation[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isProcessing = false;
  private readonly config: PersistenceConfig;
  
  // Storage adapters
  private storageAdapter: StorageAdapter;

  constructor(config: Partial<PersistenceConfig> = {}) {
    super();
    
    this.config = {
      batchSize: 100,
      flushInterval: 5000, // 5 seconds
      maxQueueSize: 10000,
      enableCompression: true,
      storageType: 'memory',
      ...config
    };
    
    // Initialize storage adapter
    this.storageAdapter = this.createStorageAdapter();
    
    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Queue pattern for persistence (non-blocking)
   */
  async storePattern(pattern: DiscoveredPattern): Promise<void> {
    this.enqueue({ type: 'store_pattern', pattern });
  }

  /**
   * Queue pattern update (non-blocking)
   */
  async updatePattern(patternId: string, updates: Partial<DiscoveredPattern>): Promise<void> {
    this.enqueue({ type: 'update_pattern', patternId, updates });
  }

  /**
   * Queue phoneme for persistence (non-blocking)
   */
  async storePhoneme(phoneme: SignalPhoneme): Promise<void> {
    this.enqueue({ type: 'store_phoneme', phoneme });
  }

  /**
   * Load patterns from storage (blocking - use sparingly)
   */
  async loadPatterns(): Promise<DiscoveredPattern[]> {
    return this.storageAdapter.loadPatterns();
  }

  /**
   * Load phonemes from storage (blocking - use sparingly)
   */
  async loadPhonemes(): Promise<SignalPhoneme[]> {
    return this.storageAdapter.loadPhonemes();
  }

  /**
   * Force flush all pending operations
   */
  async flush(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }
    
    await this.processBatch();
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      queueSize: this.operationQueue.length,
      isProcessing: this.isProcessing,
      maxQueueSize: this.config.maxQueueSize
    };
  }

  /**
   * Shutdown persistence system
   */
  async shutdown(): Promise<void> {
    // Stop timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush remaining operations
    await this.flush();
    
    // Close storage adapter
    await this.storageAdapter.close();
  }

  /**
   * Enqueue operation
   */
  private enqueue(operation: PersistenceOperation): void {
    // Check queue size
    if (this.operationQueue.length >= this.config.maxQueueSize) {
      this.emit('storage.full', this.operationQueue.length);
      // Drop oldest operation to make room
      this.operationQueue.shift();
    }
    
    this.operationQueue.push(operation);
    
    // Flush if batch size reached
    if (this.operationQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Process batch of operations
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Extract batch
      const batch = this.operationQueue.splice(0, this.config.batchSize);
      
      // Process batch
      await this.storageAdapter.processBatch(batch);
      
      this.emit('batch.flushed', batch.length);
    } catch (error) {
      this.emit('error', error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.processBatch();
    }, this.config.flushInterval);
  }

  /**
   * Create storage adapter based on config
   */
  private createStorageAdapter(): StorageAdapter {
    switch (this.config.storageType) {
      case 'memory':
        return new MemoryStorageAdapter();
      case 'file':
        return new FileStorageAdapter();
      case 'database':
        return new DatabaseStorageAdapter();
      default:
        return new MemoryStorageAdapter();
    }
  }
}

/**
 * Storage adapter interface
 */
interface StorageAdapter {
  processBatch(operations: PersistenceOperation[]): Promise<void>;
  loadPatterns(): Promise<DiscoveredPattern[]>;
  loadPhonemes(): Promise<SignalPhoneme[]>;
  close(): Promise<void>;
}

/**
 * Memory storage adapter (for testing/development)
 */
class MemoryStorageAdapter implements StorageAdapter {
  private patterns = new Map<string, DiscoveredPattern>();
  private phonemes = new Map<string, SignalPhoneme>();

  async processBatch(operations: PersistenceOperation[]): Promise<void> {
    for (const op of operations) {
      switch (op.type) {
        case 'store_pattern':
          this.patterns.set(op.pattern.id, op.pattern);
          break;
        case 'update_pattern':
          const existing = this.patterns.get(op.patternId);
          if (existing) {
            this.patterns.set(op.patternId, { ...existing, ...op.updates });
          }
          break;
        case 'store_phoneme':
          this.phonemes.set(op.phoneme.id, op.phoneme);
          break;
        case 'batch_update':
          await this.processBatch(op.operations);
          break;
      }
    }
  }

  async loadPatterns(): Promise<DiscoveredPattern[]> {
    return Array.from(this.patterns.values());
  }

  async loadPhonemes(): Promise<SignalPhoneme[]> {
    return Array.from(this.phonemes.values());
  }

  async close(): Promise<void> {
    // Nothing to close for memory storage
  }
}

/**
 * File storage adapter (for simple persistence)
 */
class FileStorageAdapter implements StorageAdapter {
  private patternsFile = 'patterns.json';
  private phonemesFile = 'phonemes.json';

  async processBatch(operations: PersistenceOperation[]): Promise<void> {
    // Load existing data
    const patterns = await this.loadPatterns();
    const phonemes = await this.loadPhonemes();
    
    const patternsMap = new Map(patterns.map(p => [p.id, p]));
    const phonemesMap = new Map(phonemes.map(p => [p.id, p]));
    
    // Process operations
    for (const op of operations) {
      switch (op.type) {
        case 'store_pattern':
          patternsMap.set(op.pattern.id, op.pattern);
          break;
        case 'update_pattern':
          const existing = patternsMap.get(op.patternId);
          if (existing) {
            patternsMap.set(op.patternId, { ...existing, ...op.updates });
          }
          break;
        case 'store_phoneme':
          phonemesMap.set(op.phoneme.id, op.phoneme);
          break;
      }
    }
    
    // Write back to files
    await this.writeFile(this.patternsFile, Array.from(patternsMap.values()));
    await this.writeFile(this.phonemesFile, Array.from(phonemesMap.values()));
  }

  async loadPatterns(): Promise<DiscoveredPattern[]> {
    try {
      const data = await this.readFile(this.patternsFile);
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async loadPhonemes(): Promise<SignalPhoneme[]> {
    try {
      const data = await this.readFile(this.phonemesFile);
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async close(): Promise<void> {
    // Nothing to close for file storage
  }

  private async readFile(filename: string): Promise<string> {
    // File system operations would go here
    // For now, return empty string
    return '';
  }

  private async writeFile(filename: string, data: any): Promise<void> {
    // File system operations would go here
    // For now, do nothing
  }
}

/**
 * Database storage adapter (for production)
 */
class DatabaseStorageAdapter implements StorageAdapter {
  async processBatch(operations: PersistenceOperation[]): Promise<void> {
    // Database operations would go here
    // Could use SQLite, PostgreSQL, etc.
  }

  async loadPatterns(): Promise<DiscoveredPattern[]> {
    // Database query would go here
    return [];
  }

  async loadPhonemes(): Promise<SignalPhoneme[]> {
    // Database query would go here
    return [];
  }

  async close(): Promise<void> {
    // Close database connection
  }
}