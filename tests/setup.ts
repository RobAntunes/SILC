// Test setup file for Jest
// This file runs before all tests

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Mock SharedArrayBuffer if not available (for testing environments)
if (typeof SharedArrayBuffer === 'undefined') {
  (global as any).SharedArrayBuffer = ArrayBuffer;
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SILC_LOG_LEVEL = 'error'; // Only log errors during tests

// Increase timeout for CI environments
if (process.env.CI) {
  jest.setTimeout(30000);
}

export {};