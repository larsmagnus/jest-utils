const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.js'],

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // TypeScript configuration
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // File extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Collect coverage from TypeScript files
  collectCoverageFrom: ['src/**/*.ts', 'mixed/**/*.ts', '!src/**/*.d.ts'],

  // Coverage output
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}

export default config
