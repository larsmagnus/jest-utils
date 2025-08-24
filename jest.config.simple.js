const config = {
  testEnvironment: 'node',
  // Test file patterns
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.js'],
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // TypeScript configuration
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  // Collect coverage from TypeScript files
  collectCoverageFrom: ['src/**/*.ts', 'mixed/**/*.ts', '!src/**/*.d.ts'],
}

export default config
