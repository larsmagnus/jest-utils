/**
 * Memory Leak Detection Configuration
 *
 * Centralized configuration for memory leak detection across all environments
 */

export interface LeakDetectionConfig {
  // Memory thresholds
  memoryThresholdMB: number
  heapGrowthThreshold: number

  // Resource tracking
  trackEventListeners: boolean
  trackTimers: boolean
  trackGlobals: boolean
  trackPromises: boolean

  // Reporting
  generateHeapSnapshots: boolean
  heapSnapshotDir: string
  logFile: string
  verbose: boolean

  // Test filtering
  excludePatterns: string[]
  includePatterns: string[]
}

const baseConfig: LeakDetectionConfig = {
  // Memory thresholds
  memoryThresholdMB: 50, // Alert if test increases memory by 50MB
  heapGrowthThreshold: 0.2, // Alert if heap grows by 20%

  // Resource tracking
  trackEventListeners: true,
  trackTimers: true,
  trackGlobals: true,
  trackPromises: true,

  // Reporting
  generateHeapSnapshots: false,
  heapSnapshotDir: './reports/heap-snapshots',
  logFile: 'leak-detection.log',
  verbose: false,

  // Test filtering
  excludePatterns: [],
  includePatterns: [],
}

const environmentConfigs: Record<string, Partial<LeakDetectionConfig>> = {
  development: {
    verbose: true,
    generateHeapSnapshots: true,
    memoryThresholdMB: 25,
  },

  test: {
    verbose: false,
    generateHeapSnapshots: false,
    memoryThresholdMB: 50,
  },

  ci: {
    verbose: false,
    generateHeapSnapshots: false,
    memoryThresholdMB: 100, // More lenient in CI
    excludePatterns: ['**/node_modules/**'],
  },

  production: {
    verbose: false,
    generateHeapSnapshots: false,
    trackEventListeners: false,
    trackPromises: false,
    memoryThresholdMB: 200,
  },
}

export function getLeakDetectionConfig(
  environment?: string
): LeakDetectionConfig {
  const env = environment || process.env.NODE_ENV || 'development'
  const envConfig = environmentConfigs[env] || {}

  return {
    ...baseConfig,
    ...envConfig,
  }
}

export default getLeakDetectionConfig
