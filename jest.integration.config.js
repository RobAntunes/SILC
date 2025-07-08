/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: [
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@signal/(.*)$': '<rootDir>/src/signal/$1',
    '^@memory/(.*)$': '<rootDir>/src/memory/$1',
    '^@dialect/(.*)$': '<rootDir>/src/dialect/$1',
    '^@transport/(.*)$': '<rootDir>/src/transport/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1',
    '^@bridge/(.*)$': '<rootDir>/src/bridge/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // Longer timeout for integration tests
  verbose: true,
};