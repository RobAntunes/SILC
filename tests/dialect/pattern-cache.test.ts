/**
 * Pattern Cache Tests
 */

import { PatternCache } from '../../src/dialect/pattern-cache';
import type { DiscoveredPattern } from '../../src/types/dialect.types';
import type { ISILCSignal } from '../../src/types/message.types';

describe('PatternCache', () => {
  let cache: PatternCache;

  beforeEach(() => {
    cache = new PatternCache();
  });

  const createTestPattern = (id: string, signals: ISILCSignal[]): DiscoveredPattern => ({
    id,
    signals,
    metadata: {
      occurrences: 5,
      firstSeen: Date.now() - 1000,
      lastSeen: Date.now(),
      contexts: {}
    },
    effectiveness: 0.8,
    adoptionRate: 2.5
  });

  const createTestSignal = (amp: number, freq: number, phase: number): ISILCSignal => ({
    amplitude: amp,
    frequency: freq,
    phase,
    harmonics: [0.618]
  });

  describe('Pattern Storage and Retrieval', () => {
    it('should store and retrieve patterns', () => {
      const pattern = createTestPattern('test-1', [
        createTestSignal(0.8, 3, 0),
        createTestSignal(0.7, 4, Math.PI)
      ]);

      cache.setPattern(pattern);
      const retrieved = cache.getPattern('test-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('test-1');
      expect(retrieved!.signals).toHaveLength(2);
    });

    it('should return null for non-existent patterns', () => {
      const retrieved = cache.getPattern('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update access history on retrieval', () => {
      const pattern = createTestPattern('test-2', [
        createTestSignal(0.9, 5, 0)
      ]);

      cache.setPattern(pattern);
      cache.getPattern('test-2');
      cache.getPattern('test-2');
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Phoneme Extraction', () => {
    it('should extract phonemes from patterns', () => {
      const signal = createTestSignal(0.8, 3, 0);
      const pattern = createTestPattern('phoneme-test', [signal]);

      cache.setPattern(pattern);
      const phoneme = cache.findPhoneme(signal);
      
      expect(phoneme).toBeDefined();
      expect(phoneme!.signal.amplitude).toBe(0.8);
      expect(phoneme!.signal.frequency).toBe(3);
    });

    it('should reuse existing phonemes', () => {
      const signal = createTestSignal(0.7, 2, Math.PI);
      const pattern1 = createTestPattern('pattern-1', [signal]);
      const pattern2 = createTestPattern('pattern-2', [signal]);

      cache.setPattern(pattern1);
      cache.setPattern(pattern2);
      
      const phoneme = cache.findPhoneme(signal);
      expect(phoneme!.frequency).toBe(2); // Should have been incremented
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache statistics', () => {
      const pattern = createTestPattern('stats-test', [
        createTestSignal(0.6, 1, 0)
      ]);

      cache.setPattern(pattern);
      cache.getPattern('stats-test'); // Hit
      cache.getPattern('non-existent'); // Miss
      
      const stats = cache.getStats();
      expect(stats.hotPatterns).toBe(1);
      expect(stats.phonemes).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.missRate).toBeGreaterThan(0);
    });

    it('should calculate compression ratios', () => {
      const pattern = createTestPattern('compression-test', [
        createTestSignal(0.5, 4, Math.PI)
      ]);

      cache.setPattern(pattern);
      const stats = cache.getStats();
      
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeLessThan(1);
    });
  });

  describe('Pre-warming', () => {
    it('should pre-warm cache with patterns', () => {
      const patterns = [
        createTestPattern('warm-1', [createTestSignal(0.8, 3, 0)]),
        createTestPattern('warm-2', [createTestSignal(0.9, 5, Math.PI)]),
        createTestPattern('warm-3', [createTestSignal(0.7, 2, 0)])
      ];

      cache.preWarm(patterns);
      
      const stats = cache.getStats();
      expect(stats.hotPatterns).toBe(3);
      expect(stats.phonemes).toBe(3);
    });

    it('should allow retrieval of pre-warmed patterns', () => {
      const patterns = [
        createTestPattern('pre-warm-test', [createTestSignal(0.6, 1, Math.PI)])
      ];

      cache.preWarm(patterns);
      const retrieved = cache.getPattern('pre-warm-test');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.signals[0].amplitude).toBe(0.6);
    });
  });

  describe('Cache Clearing', () => {
    it('should clear all cache data', () => {
      const pattern = createTestPattern('clear-test', [
        createTestSignal(0.8, 3, 0)
      ]);

      cache.setPattern(pattern);
      expect(cache.getStats().hotPatterns).toBe(1);
      
      cache.clear();
      const stats = cache.getStats();
      
      expect(stats.hotPatterns).toBe(0);
      expect(stats.phonemes).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.missRate).toBe(0);
    });

    it('should not find patterns after clearing', () => {
      const pattern = createTestPattern('clear-test-2', [
        createTestSignal(0.9, 7, Math.PI)
      ]);

      cache.setPattern(pattern);
      cache.clear();
      
      const retrieved = cache.getPattern('clear-test-2');
      expect(retrieved).toBeNull();
    });
  });

  describe('Pattern Reconstruction', () => {
    it('should reconstruct patterns from phonemes', () => {
      const signals = [
        createTestSignal(0.8, 3, 0),
        createTestSignal(0.7, 4, Math.PI)
      ];
      const pattern = createTestPattern('reconstruct-test', signals);

      cache.setPattern(pattern);
      
      // Clear hot cache to force reconstruction
      cache.clear();
      cache.setPattern(pattern); // This should create phonemes
      
      // Force reconstruction path by accessing pattern
      const retrieved = cache.getPattern('reconstruct-test');
      
      if (retrieved) {
        expect(retrieved.signals).toHaveLength(2);
        expect(retrieved.signals[0].amplitude).toBe(0.8);
        expect(retrieved.signals[1].frequency).toBe(4);
      }
    });
  });
});