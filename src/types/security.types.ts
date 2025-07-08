/**
 * Security type definitions for SILC Protocol
 */

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Enable encryption */
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
    keyRotationInterval: number;
  };
  
  /** Authentication settings */
  authentication: {
    enabled: boolean;
    method: 'hmac' | 'ecdsa' | 'rsa';
    keySize: number;
  };
  
  /** Access control */
  accessControl: {
    enabled: boolean;
    permissions: PermissionModel;
    auditLogging: boolean;
  };
  
  /** Memory protection */
  memoryProtection: {
    encryptSensitiveRegions: boolean;
    secureMemoryClearing: boolean;
    preventSideChannelAttacks: boolean;
  };
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption algorithm */
  algorithm: string;
  
  /** Key derivation settings */
  keyDerivation: {
    method: 'pbkdf2' | 'scrypt' | 'argon2';
    iterations: number;
    saltSize: number;
  };
  
  /** Initialization vector settings */
  iv: {
    size: number;
    randomSource: 'crypto' | 'system';
  };
  
  /** Additional authenticated data */
  aad?: Uint8Array;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
  /** Whether authentication succeeded */
  authenticated: boolean;
  
  /** Agent identity if authenticated */
  agentId?: string;
  
  /** Authentication method used */
  method: string;
  
  /** Timestamp of authentication */
  timestamp: number;
  
  /** Session information */
  session?: {
    sessionId: string;
    expiresAt: number;
    permissions: string[];
  };
  
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Permission model for access control
 */
export interface PermissionModel {
  /** Agent permissions */
  agent: {
    canRead: boolean;
    canWrite: boolean;
    canExecute: boolean;
  };
  
  /** Resource permissions */
  resources: {
    memory: Permission;
    signals: Permission;
    dialects: Permission;
  };
  
  /** Operation permissions */
  operations: {
    createSignal: boolean;
    transmitSignal: boolean;
    receiveSignal: boolean;
    modifyDialect: boolean;
  };
}

/**
 * Individual permission settings
 */
export interface Permission {
  read: boolean;
  write: boolean;
  execute: boolean;
  admin: boolean;
}