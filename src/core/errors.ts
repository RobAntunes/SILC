/**
 * SILC Protocol Error System
 * 
 * Comprehensive error handling for the SILC protocol with categorization,
 * severity levels, and context tracking.
 */

import { SILCErrorCategory, ErrorSeverity } from '../types/common.types';

/**
 * SILC Protocol Error Class
 */
export class SILCError extends Error {
  public readonly category: SILCErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: number;
  public readonly context: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(
    message: string,
    category: SILCErrorCategory,
    severity: ErrorSeverity,
    code: number,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    
    this.name = 'SILCError';
    this.category = category;
    this.severity = severity;
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SILCError);
    }
  }

  /**
   * Create error from another error with SILC context
   */
  public static fromError(
    error: Error,
    category: SILCErrorCategory,
    severity: ErrorSeverity,
    code: number,
    context: Record<string, unknown> = {}
  ): SILCError {
    const silcError = new SILCError(
      error.message,
      category,
      severity,
      code,
      { originalError: error.name, ...context }
    );
    
    // Preserve original stack trace
    silcError.stack = error.stack;
    
    return silcError;
  }

  /**
   * Convert to JSON for logging/transmission
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get error description with context
   */
  public getDescription(): string {
    const contextStr = Object.keys(this.context).length > 0 
      ? ` (Context: ${JSON.stringify(this.context)})`
      : '';
    
    return `[${this.category}:${this.code}] ${this.message}${contextStr}`;
  }

  /**
   * Check if error is recoverable based on category and severity
   */
  public isRecoverable(): boolean {
    // Critical errors are not recoverable
    if (this.severity === 4) return false;

    // Some categories are inherently non-recoverable
    const nonRecoverableCategories = [
      'protocol.version_mismatch',
      'system.hardware_failure',
      'system.termination'
    ];

    return !nonRecoverableCategories.includes(this.category);
  }

  /**
   * Get suggested retry delay in milliseconds
   */
  public getRetryDelay(): number {
    switch (this.severity) {
      case 4: return -1; // Critical - no retry
      case 3: return 5000; // High - 5 seconds
      case 2: return 2000; // Medium - 2 seconds
      case 1: return 1000; // Low - 1 second
      case 0: return 500;  // Info - 500ms
      default: return 1000;
    }
  }
}

/**
 * Error factory for common SILC errors
 */
export class ErrorFactory {
  /**
   * Create signal encoding error
   */
  public static signalEncoding(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.SIGNAL_CORRUPTION,
      3, // High severity
      201,
      context
    );
  }

  /**
   * Create signal validation error
   */
  public static signalValidation(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.INVALID_SIGNAL_PARAMETERS,
      3, // High severity
      200,
      context
    );
  }

  /**
   * Create memory allocation error
   */
  public static memoryAllocation(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.INSUFFICIENT_MEMORY,
      4, // Critical severity
      300,
      context
    );
  }

  /**
   * Create transmission timeout error
   */
  public static transmissionTimeout(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.TRANSMISSION_TIMEOUT,
      2, // Medium severity
      400,
      context
    );
  }

  /**
   * Create dialect incompatibility error
   */
  public static dialectIncompatible(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.DIALECT_INCOMPATIBILITY,
      2, // Medium severity
      500,
      context
    );
  }

  /**
   * Create protocol version mismatch error
   */
  public static versionMismatch(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.PROTOCOL_VERSION_MISMATCH,
      3, // High severity
      100,
      context
    );
  }

  /**
   * Create resource exhaustion error
   */
  public static resourceExhaustion(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.RESOURCE_EXHAUSTION,
      3, // High severity
      600,
      context
    );
  }

  /**
   * Create invalid message format error
   */
  public static invalidFormat(message: string, context?: Record<string, unknown>): SILCError {
    return new SILCError(
      message,
      SILCErrorCategory.INVALID_MESSAGE_FORMAT,
      3, // High severity
      101,
      context
    );
  }
}

/**
 * Error handler with automatic recovery attempts
 */
export class ErrorHandler {
  private retryCount = new Map<string, number>();
  private maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  /**
   * Handle error with automatic retry logic
   */
  public async handle<T>(
    operation: () => Promise<T>,
    errorKey: string,
    onError?: (error: SILCError, attempt: number) => void
  ): Promise<T> {
    const attempts = this.retryCount.get(errorKey) ?? 0;

    try {
      const result = await operation();
      
      // Reset retry count on success
      this.retryCount.delete(errorKey);
      
      return result;
    } catch (error) {
      const silcError = error instanceof SILCError 
        ? error 
        : SILCError.fromError(
            error as Error,
            SILCErrorCategory.UNEXPECTED_TERMINATION,
            2,
            603
          );

      // Call error callback
      if (onError) {
        onError(silcError, attempts + 1);
      }

      // Check if we should retry
      if (attempts < this.maxRetries && silcError.isRecoverable()) {
        this.retryCount.set(errorKey, attempts + 1);
        
        // Wait before retry
        const delay = silcError.getRetryDelay();
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Recursive retry
        return this.handle(operation, errorKey, onError);
      }

      // Max retries exceeded or non-recoverable error
      this.retryCount.delete(errorKey);
      throw silcError;
    }
  }

  /**
   * Reset retry count for a specific key
   */
  public resetRetries(errorKey: string): void {
    this.retryCount.delete(errorKey);
  }

  /**
   * Get current retry count for a key
   */
  public getRetryCount(errorKey: string): number {
    return this.retryCount.get(errorKey) ?? 0;
  }

  /**
   * Clear all retry counts
   */
  public clearRetries(): void {
    this.retryCount.clear();
  }
}