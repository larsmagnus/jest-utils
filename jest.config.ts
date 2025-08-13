import type { Config } from 'jest'
import { getConfig } from './jest.config.performance'

const config: Config = {
  // TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Custom reporter configuration
  reporters: [
    'default', // Keep the default reporter
    [
      '<rootDir>/src/reporters/flake-reporter.ts',
      {
        logFile: 'test-report.log',
        enableLeakDetection: true,
        leakDetection: {
          memoryThresholdMB: 25,
          generateHeapSnapshots: false,
          verbose: false,
        },
      },
    ],
    ['<rootDir>/src/reporters/performance-reporter.ts', getConfig() as any],
  ],

  // Multi-project configuration for different environments and file types
  projects: [
    {
      displayName: 'client-js',
      testMatch: [
        '<rootDir>/client/**/*.test.js',
        '<rootDir>/mixed/**/*.client.test.js',
        '<rootDir>/mixed/**/*.test.js',
        '!**/*.server.test.js',
        '!**/*.test.ts',
      ],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'server-js',
      testMatch: [
        '<rootDir>/server/**/*.test.js',
        '<rootDir>/mixed/**/*.server.test.js',
        '<rootDir>/mixed/**/*.test.js',
        '!**/*.client.test.js',
        '!**/*.test.ts',
      ],
      testEnvironment: 'node',
    },
    {
      displayName: 'client-ts',
      preset: 'ts-jest',
      testMatch: [
        '<rootDir>/client/**/*.test.ts',
        '<rootDir>/mixed/**/*.client.test.ts',
        '<rootDir>/mixed/**/*.test.ts',
        '!**/*.server.test.ts',
      ],
      testEnvironment: 'jsdom',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'server-ts',
      preset: 'ts-jest',
      testMatch: [
        '<rootDir>/server/**/*.test.ts',
        '<rootDir>/mixed/**/*.server.test.ts',
        '<rootDir>/mixed/**/*.test.ts',
        '!**/*.client.test.ts',
      ],
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],
}

export default config
