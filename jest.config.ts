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
      displayName: 'client',
      transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
      },
      testMatch: [
        '<rootDir>/client/**/*.test.js',
        '<rootDir>/client/**/*.test.ts',
        '<rootDir>/mixed/**/*.client.test.js',
        '<rootDir>/mixed/**/*.client.test.ts',
        '<rootDir>/mixed/**/*.test.js',
        '<rootDir>/mixed/**/*.test.ts',
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
        '<rootDir>/server/**/*.test.js',
        '<rootDir>/server/**/*.test.ts',
        '<rootDir>/mixed/**/*.server.test.js',
        '<rootDir>/mixed/**/*.server.test.ts',
        '<rootDir>/mixed/**/*.test.js',
        '<rootDir>/mixed/**/*.test.ts',
        '!**/*.client.test.js',
        '!**/*.client.test.ts',
      ],
      testEnvironment: 'node',
    },
  ],
}

export default config
