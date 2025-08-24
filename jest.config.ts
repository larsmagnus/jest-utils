import type { Config } from 'jest'
import { getConfig } from './jest.config.performance'

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Custom reporter configuration
  reporters: [
    'default', // Keep the default reporter
    [
      '<rootDir>/lib/reporters/memory-reporter.ts',
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
    ['<rootDir>/lib/reporters/performance-reporter.ts', getConfig() as any],
  ],
  // Multi-project configuration for different environments and file types
  projects: [
    {
      displayName: 'client',
      transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
      },
      testMatch: [
        '<rootDir>/src/client/**/*.test.js',
        '<rootDir>/src/client/**/*.test.ts',
        '<rootDir>/src/mixed/**/*.client.test.js',
        '<rootDir>/src/mixed/**/*.client.test.ts',
        '<rootDir>/src/mixed/**/*.test.js',
        '<rootDir>/src/mixed/**/*.test.ts',
        '!**/*.server.test.js',
        '!**/*.server.test.ts',
      ],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'server',
      transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
      },
      testMatch: [
        '<rootDir>/src/server/**/*.test.js',
        '<rootDir>/src/server/**/*.test.ts',
        '<rootDir>/src/mixed/**/*.server.test.js',
        '<rootDir>/src/mixed/**/*.server.test.ts',
        '<rootDir>/src/mixed/**/*.test.js',
        '<rootDir>/src/mixed/**/*.test.ts',
        '!**/*.client.test.js',
        '!**/*.client.test.ts',
      ],
      testEnvironment: 'node',
    },
  ],
}

export default config
