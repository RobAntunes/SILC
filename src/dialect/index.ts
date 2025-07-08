/**
 * Dialect system exports
 */

export { PatternDiscovery } from './pattern-discovery';
export type { PatternDiscoveryConfig } from './pattern-discovery';

export { EffectivenessTracker } from './effectiveness-tracker';
export type { EffectivenessConfig, CommunicationOutcome } from './effectiveness-tracker';

export { DialectManager } from './dialect-manager';
export type { DialectManagerConfig } from './dialect-manager';

export { BaseFallbackHandler, FallbackReason } from './base-fallback';

export { PatternCache } from './pattern-cache';
export type { SignalPhoneme, PatternReference, CacheStats } from './pattern-cache';

export { PatternPersistence } from './pattern-persistence';
export type { PersistenceConfig } from './pattern-persistence';

export * from '../types/dialect.types';
