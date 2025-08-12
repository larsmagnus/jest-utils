module.exports = {
  // Custom reporter configuration
  reporters: [
    'default', // Keep the default reporter
    [
      '<rootDir>/src/reporters/custom-reporter.ts',
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
    [
      '<rootDir>/src/reporters/performance-reporter.ts',
      require('./jest.config.performance.ts').getConfig(),
    ],
  ],
  projects: [
    {
      displayName: 'client',
      testMatch: [
        '<rootDir>/mixed/**/*.client.test.js',
        '<rootDir>/mixed/**/*.test.js',
        '!**/*.server.test.js',
      ],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'server',
      testMatch: [
        '<rootDir>/mixed/**/*.server.test.js',
        '<rootDir>/mixed/**/*.test.js',
        '!**/*.client.test.js',
      ],
      testEnvironment: 'node',
    },
  ],
}
