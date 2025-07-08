/**
 * SILC Protocol Configuration
 * 
 * Centralized configuration management for the SILC protocol with
 * development, production, and custom configurations.
 */

import type { SILCAgentID } from '../types/message.types';
import type { ConfigurationOptions } from '../types/common.types';

/**
 * Core SILC configuration interface
 */
export interface SILCConfig {
  // Protocol settings
  protocol: {
    version: string;
    dialectName: string;
    baseSpecFallback: boolean;
    enablePatternDiscovery: boolean;
    enableDiagnostics?: boolean;
  };

  // Agent identity
  agent: SILCAgentID;

  // Memory configuration
  memory: {
    windowSize: number;
    maxWindows: number;
    adaptiveResize: boolean;
    alignment: number;
    zeroInitialization: boolean;
  };

  // Performance tuning
  performance: {
    signalCacheSize: number;
    compressionLevel: number;
    parallelStreamSegments: number;
    maxConcurrentOperations: number;
    enableMetrics: boolean;
  };

  // Security settings
  security: {
    enableEncryption: boolean;
    enableIntegrityChecks: boolean;
    enableAuditLogging: boolean;
    maxSignalSize: number;
  };

  // Error handling
  errorHandling: {
    maxRetries: number;
    retryBackoffMultiplier: number;
    enableAutoRecovery: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  };

  // Transport configuration
  transport: {
    type: 'local' | 'remote' | 'hybrid';
    localTimeout: number;
    remoteTimeout: number;
    enableCompression: boolean;
  };

  // Additional options
  options: ConfigurationOptions;
}

/**
 * Default production configuration
 */
export const PRODUCTION_CONFIG: SILCConfig = {
  protocol: {
    version: '1.0.0',
    dialectName: 'production-optimized-v1',
    baseSpecFallback: true,
    enablePatternDiscovery: true,
    enableDiagnostics: false
  },

  agent: {
    namespace: 'silc',
    modelType: 'unknown',
    instanceId: 'prod-instance',
    dialectVersion: '1.0.0',
    capabilities: ['base-spec', 'parallel-streaming', 'compression']
  },

  memory: {
    windowSize: 4096,
    maxWindows: 10000,
    adaptiveResize: true,
    alignment: 64,
    zeroInitialization: true
  },

  performance: {
    signalCacheSize: 100000,
    compressionLevel: 6,
    parallelStreamSegments: 16,
    maxConcurrentOperations: 1000,
    enableMetrics: true
  },

  security: {
    enableEncryption: true,
    enableIntegrityChecks: true,
    enableAuditLogging: true,
    maxSignalSize: 10485760 // 10MB
  },

  errorHandling: {
    maxRetries: 3,
    retryBackoffMultiplier: 2.0,
    enableAutoRecovery: true,
    logLevel: 'WARNING'
  },

  transport: {
    type: 'hybrid',
    localTimeout: 1000,
    remoteTimeout: 5000,
    enableCompression: true
  },

  options: {
    protocolVersion: '1.0.0',
    debug: false,
    logLevel: 'warn',
    enableMetrics: true,
    autoRecovery: true,
    limits: {
      maxMemory: 1073741824, // 1GB
      maxSignalSize: 10485760, // 10MB
      maxConcurrentOperations: 1000
    }
  }
};

/**
 * Development configuration
 */
export const DEVELOPMENT_CONFIG: SILCConfig = {
  ...PRODUCTION_CONFIG,
  
  protocol: {
    ...PRODUCTION_CONFIG.protocol,
    dialectName: 'development-debug-v1',
    enableDiagnostics: true
  },

  agent: {
    ...PRODUCTION_CONFIG.agent,
    instanceId: 'dev-instance',
    capabilities: ['base-spec', 'debug', 'experimental']
  },

  memory: {
    ...PRODUCTION_CONFIG.memory,
    windowSize: 1024,
    maxWindows: 100,
    adaptiveResize: false
  },

  performance: {
    ...PRODUCTION_CONFIG.performance,
    signalCacheSize: 1000,
    compressionLevel: 1,
    parallelStreamSegments: 4,
    maxConcurrentOperations: 10,
    enableMetrics: true
  },

  security: {
    ...PRODUCTION_CONFIG.security,
    enableEncryption: false,
    maxSignalSize: 1048576 // 1MB
  },

  errorHandling: {
    ...PRODUCTION_CONFIG.errorHandling,
    maxRetries: 1,
    retryBackoffMultiplier: 1.0,
    enableAutoRecovery: false,
    logLevel: 'DEBUG'
  },

  transport: {
    ...PRODUCTION_CONFIG.transport,
    type: 'local',
    localTimeout: 100,
    remoteTimeout: 1000
  },

  options: {
    ...PRODUCTION_CONFIG.options,
    debug: true,
    logLevel: 'debug',
    limits: {
      maxMemory: 134217728, // 128MB
      maxSignalSize: 1048576, // 1MB
      maxConcurrentOperations: 10
    }
  }
};

/**
 * Test configuration for unit tests
 */
export const TEST_CONFIG: SILCConfig = {
  ...DEVELOPMENT_CONFIG,
  
  protocol: {
    ...DEVELOPMENT_CONFIG.protocol,
    dialectName: 'test-minimal-v1'
  },

  agent: {
    ...DEVELOPMENT_CONFIG.agent,
    instanceId: 'test-instance'
  },

  memory: {
    ...DEVELOPMENT_CONFIG.memory,
    windowSize: 256,
    maxWindows: 10
  },

  performance: {
    ...DEVELOPMENT_CONFIG.performance,
    signalCacheSize: 100,
    maxConcurrentOperations: 1
  },

  errorHandling: {
    ...DEVELOPMENT_CONFIG.errorHandling,
    logLevel: 'ERROR' // Quiet during tests
  },

  options: {
    ...DEVELOPMENT_CONFIG.options,
    logLevel: 'error'
  }
};

/**
 * Default configuration (production)
 */
export const DEFAULT_CONFIG = PRODUCTION_CONFIG;

/**
 * Configuration builder class
 */
export class ConfigBuilder {
  private config: Partial<SILCConfig> = {};

  /**
   * Start with a base configuration
   */
  public static from(base: SILCConfig): ConfigBuilder {
    const builder = new ConfigBuilder();
    builder.config = structuredClone(base);
    return builder;
  }

  /**
   * Set agent configuration
   */
  public withAgent(agent: Partial<SILCAgentID>): ConfigBuilder {
    this.config.agent = { ...this.config.agent, ...agent } as SILCAgentID;
    return this;
  }

  /**
   * Set protocol configuration
   */
  public withProtocol(protocol: Partial<SILCConfig['protocol']>): ConfigBuilder {
    this.config.protocol = { ...this.config.protocol, ...protocol } as SILCConfig['protocol'];
    return this;
  }

  /**
   * Set memory configuration
   */
  public withMemory(memory: Partial<SILCConfig['memory']>): ConfigBuilder {
    this.config.memory = { ...this.config.memory, ...memory } as SILCConfig['memory'];
    return this;
  }

  /**
   * Set performance configuration
   */
  public withPerformance(performance: Partial<SILCConfig['performance']>): ConfigBuilder {
    this.config.performance = { ...this.config.performance, ...performance } as SILCConfig['performance'];
    return this;
  }

  /**
   * Set security configuration
   */
  public withSecurity(security: Partial<SILCConfig['security']>): ConfigBuilder {
    this.config.security = { ...this.config.security, ...security } as SILCConfig['security'];
    return this;
  }

  /**
   * Enable debug mode
   */
  public withDebug(enabled: boolean = true): ConfigBuilder {
    if (!this.config.options) this.config.options = {} as ConfigurationOptions;
    this.config.options.debug = enabled;
    this.config.options.logLevel = enabled ? 'debug' : 'warn';
    
    if (!this.config.errorHandling) this.config.errorHandling = { ...DEVELOPMENT_CONFIG.errorHandling };
    this.config.errorHandling.logLevel = enabled ? 'DEBUG' : 'WARNING';
    
    return this;
  }

  /**
   * Set compression level
   */
  public withCompression(level: number): ConfigBuilder {
    if (!this.config.performance) this.config.performance = { ...PRODUCTION_CONFIG.performance };
    this.config.performance.compressionLevel = Math.max(0, Math.min(9, level));
    return this;
  }

  /**
   * Build the final configuration
   */
  public build(): SILCConfig {
    // Validate and fill in missing required fields
    const config = this.config as SILCConfig;
    
    if (!config.protocol) config.protocol = DEFAULT_CONFIG.protocol;
    if (!config.agent) config.agent = DEFAULT_CONFIG.agent;
    if (!config.memory) config.memory = DEFAULT_CONFIG.memory;
    if (!config.performance) config.performance = DEFAULT_CONFIG.performance;
    if (!config.security) config.security = DEFAULT_CONFIG.security;
    if (!config.errorHandling) config.errorHandling = DEFAULT_CONFIG.errorHandling;
    if (!config.transport) config.transport = DEFAULT_CONFIG.transport;
    if (!config.options) config.options = DEFAULT_CONFIG.options;

    return config;
  }
}

/**
 * Environment-based configuration loader
 */
export class ConfigLoader {
  /**
   * Load configuration based on NODE_ENV
   */
  public static loadFromEnvironment(): SILCConfig {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return PRODUCTION_CONFIG;
      case 'test':
        return TEST_CONFIG;
      case 'development':
      default:
        return DEVELOPMENT_CONFIG;
    }
  }

  /**
   * Load configuration from environment variables
   */
  public static loadFromEnv(): SILCConfig {
    const base = this.loadFromEnvironment();
    
    return ConfigBuilder
      .from(base)
      .withAgent({
        namespace: process.env.SILC_NAMESPACE || base.agent.namespace,
        modelType: process.env.SILC_MODEL_TYPE || base.agent.modelType,
        instanceId: process.env.SILC_INSTANCE_ID || base.agent.instanceId
      })
      .withDebug(process.env.SILC_DEBUG === 'true')
      .withCompression(parseInt(process.env.SILC_COMPRESSION_LEVEL || '6'))
      .build();
  }

  /**
   * Validate configuration
   */
  public static validate(config: SILCConfig): void {
    const errors: string[] = [];

    // Validate required fields
    if (!config.agent.namespace) errors.push('Agent namespace is required');
    if (!config.agent.modelType) errors.push('Agent model type is required');
    if (!config.agent.instanceId) errors.push('Agent instance ID is required');

    // Validate ranges
    if (config.memory.windowSize <= 0) errors.push('Memory window size must be positive');
    if (config.performance.compressionLevel < 0 || config.performance.compressionLevel > 9) {
      errors.push('Compression level must be between 0 and 9');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
}