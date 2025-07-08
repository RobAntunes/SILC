/**
 * SILC Interpreter Tests
 */

import { SILCInterpreter } from '../../src/interpreter/silc-interpreter';
import type { SemanticIntent, InterpretationResult } from '../../src/interpreter/silc-interpreter';
import type { ISILCSignal } from '../../src/types/message.types';

describe('SILCInterpreter', () => {
  let interpreter: SILCInterpreter;

  beforeEach(() => {
    interpreter = new SILCInterpreter();
  });

  describe('Intent to Signal Conversion', () => {
    it('should map confidence to amplitude', () => {
      const intents: SemanticIntent[] = [
        { confidence: 0.0, urgency: 0.5, agreement: true, complexity: 0.3 },
        { confidence: 0.5, urgency: 0.5, agreement: true, complexity: 0.3 },
        { confidence: 1.0, urgency: 0.5, agreement: true, complexity: 0.3 }
      ];

      const signals = intents.map(intent => interpreter.intentToSignal(intent));
      
      expect(signals[0].amplitude).toBe(0.0);
      expect(signals[1].amplitude).toBe(0.5);
      expect(signals[2].amplitude).toBe(1.0);
    });

    it('should map urgency to frequency bands', () => {
      const intents: SemanticIntent[] = [
        { confidence: 0.8, urgency: 0.0, agreement: true, complexity: 0.3 },
        { confidence: 0.8, urgency: 0.5, agreement: true, complexity: 0.3 },
        { confidence: 0.8, urgency: 1.0, agreement: true, complexity: 0.3 }
      ];

      const signals = intents.map(intent => interpreter.intentToSignal(intent));
      
      expect(signals[0].frequency).toBe(0);
      expect(signals[1].frequency).toBe(4); // 0.5 * 7 rounded
      expect(signals[2].frequency).toBe(7);
    });

    it('should map agreement to phase', () => {
      const agreeIntent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.5,
        agreement: true,
        complexity: 0.3
      };

      const disagreeIntent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.5,
        agreement: false,
        complexity: 0.3
      };

      const agreeSignal = interpreter.intentToSignal(agreeIntent);
      const disagreeSignal = interpreter.intentToSignal(disagreeIntent);
      
      expect(agreeSignal.phase).toBe(0);
      expect(disagreeSignal.phase).toBe(Math.PI);
    });

    it('should generate harmonics based on complexity', () => {
      const simpleIntent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.5,
        agreement: true,
        complexity: 0.1
      };

      const complexIntent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.5,
        agreement: true,
        complexity: 0.8
      };

      const simpleSignal = interpreter.intentToSignal(simpleIntent);
      const complexSignal = interpreter.intentToSignal(complexIntent);
      
      expect(simpleSignal.harmonics).toBeUndefined();
      expect(complexSignal.harmonics).toBeDefined();
      expect(complexSignal.harmonics!.length).toBeGreaterThanOrEqual(2);
    });

    it('should add domain-specific harmonics', () => {
      const logicIntent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.5,
        agreement: true,
        complexity: 0.8,
        domain: 'logic'
      };

      const creativeIntent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.5,
        agreement: true,
        complexity: 0.8,
        domain: 'creative'
      };

      const logicSignal = interpreter.intentToSignal(logicIntent);
      const creativeSignal = interpreter.intentToSignal(creativeIntent);
      
      expect(logicSignal.harmonics).toContain(0.5); // Binary logic
      expect(creativeSignal.harmonics).toContain(0.333); // Thirds
      expect(creativeSignal.harmonics).toContain(0.667);
    });
  });

  describe('Signal to Intent Interpretation', () => {
    it('should extract confidence from amplitude', () => {
      const signals: ISILCSignal[] = [
        { amplitude: 0.2, frequency: 3, phase: 0 },
        { amplitude: 0.6, frequency: 3, phase: 0 },
        { amplitude: 0.95, frequency: 3, phase: 0 }
      ];

      const results = signals.map(signal => interpreter.signalToIntent(signal));
      
      expect(results[0].intent.confidence).toBe(0.2);
      expect(results[1].intent.confidence).toBe(0.6);
      expect(results[2].intent.confidence).toBe(0.95);
    });

    it('should extract urgency from frequency', () => {
      const signals: ISILCSignal[] = [
        { amplitude: 0.8, frequency: 0, phase: 0 },
        { amplitude: 0.8, frequency: 4, phase: 0 },
        { amplitude: 0.8, frequency: 7, phase: 0 }
      ];

      const results = signals.map(signal => interpreter.signalToIntent(signal));
      
      expect(results[0].intent.urgency).toBeCloseTo(0.0);
      expect(results[1].intent.urgency).toBeCloseTo(0.571, 2); // 4/7
      expect(results[2].intent.urgency).toBeCloseTo(1.0);
    });

    it('should extract agreement from phase', () => {
      const agreeSignal: ISILCSignal = { amplitude: 0.8, frequency: 3, phase: 0 };
      const disagreeSignal: ISILCSignal = { amplitude: 0.8, frequency: 3, phase: Math.PI };

      const agreeResult = interpreter.signalToIntent(agreeSignal);
      const disagreeResult = interpreter.signalToIntent(disagreeSignal);
      
      expect(agreeResult.intent.agreement).toBe(true);
      expect(disagreeResult.intent.agreement).toBe(false);
    });

    it('should calculate complexity from harmonics', () => {
      const simpleSignal: ISILCSignal = { amplitude: 0.8, frequency: 3, phase: 0 };
      const complexSignal: ISILCSignal = {
        amplitude: 0.8,
        frequency: 3,
        phase: 0,
        harmonics: [0.618, 0.382, 0.5, 0.333]
      };

      const simpleResult = interpreter.signalToIntent(simpleSignal);
      const complexResult = interpreter.signalToIntent(complexSignal);
      
      expect(simpleResult.intent.complexity).toBeLessThan(0.2);
      expect(complexResult.intent.complexity).toBeGreaterThan(0.7);
    });

    it('should detect pattern matches', () => {
      const alertSignal: ISILCSignal = {
        amplitude: 0.95,
        frequency: 7,
        phase: 0
      };

      const result = interpreter.signalToIntent(alertSignal);
      expect(result.context.patternMatched).toBe('urgent-alert');
    });

    it('should throw on invalid signal', () => {
      const invalidSignal: ISILCSignal = {
        amplitude: 1.5, // Out of range
        frequency: 3,
        phase: 0
      };

      expect(() => interpreter.signalToIntent(invalidSignal)).toThrow();
    });
  });

  describe('Teaching Examples', () => {
    it('should provide comprehensive examples', () => {
      const examples = interpreter.getTeachingExamples();
      
      expect(examples.length).toBeGreaterThan(0);
      
      examples.forEach(example => {
        expect(example.description).toBeDefined();
        expect(example.intent).toBeDefined();
        expect(example.signal).toBeDefined();
        expect(example.explanation).toBeDefined();
        
        // Verify intent matches signal
        const signal = interpreter.intentToSignal(example.intent);
        expect(signal.amplitude).toBeCloseTo(example.signal.amplitude, 1);
        expect(signal.frequency).toBe(example.signal.frequency);
        expect(signal.phase).toBe(example.signal.phase);
      });
    });

    it('should cover different communication scenarios', () => {
      const examples = interpreter.getTeachingExamples();
      const descriptions = examples.map(e => e.description);
      
      expect(descriptions).toContain('High confidence agreement');
      expect(descriptions).toContain('Urgent disagreement');
      expect(descriptions).toContain('Uncertain exploration');
      expect(descriptions).toContain('Emergency alert');
    });
  });

  describe('Learning Prompt', () => {
    it('should create comprehensive learning prompt', () => {
      const prompt = interpreter.createLearningPrompt();
      
      expect(prompt).toContain('SILC');
      expect(prompt).toContain('Self-Interpreting Local Communication');
      expect(prompt).toContain('Amplitude');
      expect(prompt).toContain('Frequency');
      expect(prompt).toContain('Phase');
      expect(prompt).toContain('Harmonics');
      expect(prompt).toContain('self-interpreting');
    });
  });

  describe('Pattern Learning', () => {
    it('should learn patterns from usage', () => {
      const intent: SemanticIntent = {
        confidence: 0.8,
        urgency: 0.6,
        agreement: true,
        complexity: 0.4
      };
      
      const signal = interpreter.intentToSignal(intent);
      
      interpreter.learnPattern(intent, signal, 'reasoning');
      interpreter.learnPattern(intent, signal, 'reasoning');
      
      // Pattern should be stored in memory
      expect(interpreter['patternMemory'].size).toBeGreaterThan(0);
    });

    it('should group similar patterns', () => {
      const intent1: SemanticIntent = {
        confidence: 0.81,
        urgency: 0.59,
        agreement: true,
        complexity: 0.4
      };
      
      const intent2: SemanticIntent = {
        confidence: 0.79,
        urgency: 0.61,
        agreement: true,
        complexity: 0.4
      };
      
      const signal1 = interpreter.intentToSignal(intent1);
      const signal2 = interpreter.intentToSignal(intent2);
      
      interpreter.learnPattern(intent1, signal1, 'reasoning');
      interpreter.learnPattern(intent2, signal2, 'reasoning');
      
      // Should group into same pattern key
      expect(interpreter['patternMemory'].size).toBe(1);
      const patterns = Array.from(interpreter['patternMemory'].values())[0];
      expect(patterns.length).toBe(2);
    });
  });

  describe('Round-trip Conversion', () => {
    it('should maintain semantic meaning through conversion', () => {
      const originalIntent: SemanticIntent = {
        confidence: 0.75,
        urgency: 0.6,
        agreement: false,
        complexity: 0.5
      };
      
      const signal = interpreter.intentToSignal(originalIntent);
      const result = interpreter.signalToIntent(signal);
      const recoveredIntent = result.intent;
      
      expect(recoveredIntent.confidence).toBeCloseTo(originalIntent.confidence, 2);
      expect(recoveredIntent.urgency).toBeCloseTo(originalIntent.urgency, 1);
      expect(recoveredIntent.agreement).toBe(originalIntent.agreement);
      expect(recoveredIntent.complexity).toBeCloseTo(originalIntent.complexity, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme values gracefully', () => {
      const extremeIntent: SemanticIntent = {
        confidence: 0,
        urgency: 1,
        agreement: true,
        complexity: 1
      };
      
      const signal = interpreter.intentToSignal(extremeIntent);
      
      expect(signal.amplitude).toBe(0);
      expect(signal.frequency).toBe(7);
      expect(signal.harmonics).toBeDefined();
      expect(signal.harmonics!.length).toBeGreaterThan(0);
    });

    it('should handle minimal complexity', () => {
      const minimalIntent: SemanticIntent = {
        confidence: 0.5,
        urgency: 0.5,
        agreement: true,
        complexity: 0
      };
      
      const signal = interpreter.intentToSignal(minimalIntent);
      expect(signal.harmonics).toBeUndefined();
    });
  });
});