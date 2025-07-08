/**
 * SILC Protocol Core Module
 *
 * Core components for the SILC protocol including the main protocol class,
 * configuration management, message building, and error handling.
 */

// Main protocol class
export { SILCProtocol } from './protocol';

// Configuration management
export type { SILCConfig } from './config';
export {
  ConfigBuilder,
  ConfigLoader,
  PRODUCTION_CONFIG,
  DEVELOPMENT_CONFIG,
  TEST_CONFIG,
  DEFAULT_CONFIG,
} from './config';

// Message building
export { MessageBuilder } from './message-builder';

// Error handling
export { SILCError, ErrorFactory, ErrorHandler } from './errors';

// Convenience exports
export type {
  ISILCMessage,
  ISILCHeader,
  SILCAgentID,
  SILCMessageType,
  MessageBuilderConfig,
  DialectExtension,
  MessageMetadata,
} from '../types/message.types';

/**
 * Create a SILC protocol instance with sensible defaults
 */
export function createSILCProtocol(
  options: {
    agentId?: {
      namespace: string;
      modelType: string;
      instanceId?: string;
    };
    debug?: boolean;
    compressionLevel?: number;
    environment?: 'development' | 'production' | 'test';
  } = {},
) {
  const { ConfigBuilder, PRODUCTION_CONFIG, TEST_CONFIG, DEVELOPMENT_CONFIG } = require('./config');
  const { SILCProtocol } = require('./protocol');

  const config = ConfigBuilder.from(
    options.environment === 'production'
      ? PRODUCTION_CONFIG
      : options.environment === 'test'
        ? TEST_CONFIG
        : DEVELOPMENT_CONFIG,
  )
    .withAgent({
      namespace: options.agentId?.namespace ?? 'default',
      modelType: options.agentId?.modelType ?? 'unknown',
      instanceId: options.agentId?.instanceId ?? `instance-${Date.now()}`,
    })
    .withDebug(options.debug ?? false)
    .withCompression(options.compressionLevel ?? 6)
    .build();

  return new SILCProtocol(config);
}

/**
 * Quick start function for immediate SILC usage
 */
export async function quickStart(agentInfo: {
  namespace: string;
  modelType: string;
  instanceId?: string;
}) {
  const protocol = createSILCProtocol({
    agentId: agentInfo,
    environment: 'development',
    debug: true,
  });

  await protocol.initialize();
  return protocol;
}
