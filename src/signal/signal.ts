/**
 * Unified SILC Signal processor
 *
 * Provides a high-level interface for signal operations
 */

import type { EncodedSignal, ISILCSignal, SignalEncodingFormat } from '../types/signal.types';
import { SignalEncoder } from './encoder';
import { SignalDecoder } from './decoder';
import { SignalValidator } from './validator';

/**
 * Unified signal processor class
 */
export class SILCSignal {
  private encoder: SignalEncoder;
  private decoder: SignalDecoder;
  private validator: SignalValidator;

  constructor() {
    this.encoder = new SignalEncoder();
    this.decoder = new SignalDecoder();
    this.validator = new SignalValidator();
  }

  /**
   * Encode a signal
   */
  encode(signal: ISILCSignal, format: SignalEncodingFormat = 'base64'): EncodedSignal {
    return this.encoder.encode(signal, format);
  }

  /**
   * Decode a signal
   */
  decode(encoded: EncodedSignal) {
    return this.decoder.decode(encoded);
  }

  /**
   * Validate a signal
   */
  validate(signal: ISILCSignal) {
    return this.validator.validate(signal);
  }

  /**
   * Create a new signal
   */
  create(
    amplitude: number,
    frequency: number,
    phase: number = 0,
    harmonics?: number[],
  ): ISILCSignal {
    return {
      amplitude,
      frequency,
      phase,
      harmonics,
    };
  }
}
