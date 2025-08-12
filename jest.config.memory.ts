/**
 * Leak Detection Configuration
 *
 * This file provides centralized configuration for memory leak detection.
 * You can customize thresholds, tracking options, and reporting preferences.
 */

module.exports = {
  // Environment-specific configurations
  development: {
    memoryThresholdMB: 50,
    heapGrowthThreshold: 0.25,
    verbose: true,
    generateHeapSnapshots: false,
    trackGlobals: true,
    trackTimers: true,
    trackEventListeners: true,
    trackPromises: false,
  },

  ci: {
    memoryThresholdMB: 30,
    heapGrowthThreshold: 0.15,
    verbose: false,
    generateHeapSnapshots: true,
    trackGlobals: true,
    trackTimers: true,
    trackEventListeners: true,
    trackPromises: true,
  },

  production: {
    memoryThresholdMB: 20,
    heapGrowthThreshold: 0.1,
    verbose: false,
    generateHeapSnapshots: true,
    trackGlobals: true,
    trackTimers: true,
    trackEventListeners: true,
    trackPromises: true,
  },

  // Common configuration
  common: {
    // Files and directories
    logFile: 'leak-detection.log',
    heapSnapshotDir: './reports/heap-snapshots',

    // Test filtering
    excludePatterns: [
      // Performance and stress tests
      'performance.*',
      'stress.*test',
      'benchmark.*',

      // Integration tests with known memory usage
      'integration.*large.*',
      'e2e.*heavy.*',

      // Tests that intentionally test memory behavior
      '.*memory.*test',
      '.*leak.*test.*intentional',
    ],

    includePatterns: [
      // Focus on specific test suites if needed
      // 'unit.*',
      // 'component.*'
    ],

    // Reporting preferences
    reportFormat: 'detailed', // 'summary' | 'detailed' | 'json'
    failOnLeaks: process.env.FAIL_ON_LEAKS === 'true',

    // Advanced options
    sampleInterval: 1000, // ms - how often to sample memory during long tests
    gcBeforeTest: process.env.GC_BEFORE_TEST === 'true', // Force GC before each test

    // Custom leak detection rules
    customRules: {
      // Warn if test creates more than X global variables
      maxNewGlobals: 5,

      // Warn if test leaves more than X timers
      maxActiveTimers: 3,

      // Warn if test adds more than X event listeners
      maxEventListeners: 10,

      // Memory growth patterns
      maxConsecutiveGrowth: 3, // Flag if memory grows for 3+ consecutive samples

      // Specific patterns to watch for
      suspiciousGlobals: [
        '__test_data__',
        'window.testVar',
        'global.cache',
        '_test_state',
      ],
    },
  },

  // Helper function to get environment-specific config
  getConfig() {
    const env = process.env.NODE_ENV || 'development'
    const envConfig = this[env] || this.development

    return {
      ...this.common,
      ...envConfig,

      // Override with environment variables
      memoryThresholdMB: process.env.LEAK_MEMORY_THRESHOLD_MB
        ? parseInt(process.env.LEAK_MEMORY_THRESHOLD_MB)
        : envConfig.memoryThresholdMB,

      heapGrowthThreshold: process.env.LEAK_HEAP_GROWTH_THRESHOLD
        ? parseFloat(process.env.LEAK_HEAP_GROWTH_THRESHOLD)
        : envConfig.heapGrowthThreshold,

      verbose:
        process.env.LEAK_DETECTION_VERBOSE === 'true' || envConfig.verbose,

      generateHeapSnapshots:
        process.env.GENERATE_HEAP_SNAPSHOTS === 'true' ||
        envConfig.generateHeapSnapshots,
    }
  },

  // Preset configurations for common scenarios
  presets: {
    // Strict settings for critical tests
    strict: {
      memoryThresholdMB: 10,
      heapGrowthThreshold: 0.05,
      verbose: true,
      generateHeapSnapshots: true,
      failOnLeaks: true,
      trackGlobals: true,
      trackTimers: true,
      trackEventListeners: true,
      trackPromises: true,
    },

    // Relaxed settings for integration tests
    relaxed: {
      memoryThresholdMB: 100,
      heapGrowthThreshold: 0.5,
      verbose: false,
      generateHeapSnapshots: false,
      failOnLeaks: false,
      trackGlobals: true,
      trackTimers: false,
      trackEventListeners: false,
      trackPromises: false,
    },

    // Performance-focused settings
    performance: {
      memoryThresholdMB: 200,
      heapGrowthThreshold: 1.0,
      verbose: true,
      generateHeapSnapshots: true,
      failOnLeaks: false,
      trackGlobals: false,
      trackTimers: false,
      trackEventListeners: false,
      trackPromises: false,
      sampleInterval: 100, // More frequent sampling
    },
  },
}
