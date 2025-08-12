/**
 * Performance Reporter Configuration
 * 
 * This configuration file allows you to customize the performance analysis
 * settings for your Jest test suite. Adjust these settings based on your
 * project's needs and performance requirements.
 */

module.exports = {
  /**
   * Output Settings
   */
  output: {
    // Directory where performance reports will be saved
    outputDir: 'reports/performance',
    
    // Enable/disable different report formats
    htmlReport: true,      // Interactive HTML dashboard
    jsonReport: true,      // Raw JSON data for further analysis
    flamegraphReport: true, // CPU flamegraph visualizations
  },

  /**
   * Profiling Settings
   */
  profiling: {
    // Enable CPU profiling (V8 profiler)
    enableCPUProfiling: true,
    
    // Enable memory profiling and heap snapshots
    enableMemoryProfiling: true,
    
    // CPU sampling interval in microseconds (lower = more detailed, higher overhead)
    sampleInterval: 1000,
    
    // Minimum frame size in flamegraphs (pixels)
    minFrameSize: 5,
  },

  /**
   * Performance Thresholds
   * 
   * Tests exceeding these thresholds will be flagged for attention
   */
  thresholds: {
    // Tests slower than this (ms) are considered slow
    slowTestThreshold: 1000,
    
    // Tests using more than this memory (MB) are flagged
    memoryThreshold: 50,
    
    // Suite-level thresholds
    slowSuiteThreshold: 5000, // ms
    
    // Memory leak detection threshold (MB increase per test)
    memoryLeakThreshold: 10,
  },

  /**
   * Historical Tracking
   * 
   * Track performance trends over time
   */
  trending: {
    // Enable performance trend tracking
    enabled: true,
    
    // Maximum number of historical runs to keep
    maxHistoryRuns: 100,
    
    // Enable regression detection
    enableRegressionDetection: true,
    
    // Regression threshold (% increase from baseline)
    regressionThreshold: 20,
  },

  /**
   * Flamegraph Settings
   */
  flamegraph: {
    // Flamegraph dimensions
    width: 1200,
    height: 600,
    
    // Cell height in pixels
    cellHeight: 18,
    
    // Animation settings
    transitionDuration: 750,
    
    // Color scheme for flamegraphs
    colorScheme: 'warm', // 'warm', 'cool', 'rainbow'
  },

  /**
   * Analysis Settings
   */
  analysis: {
    // Enable automatic bottleneck detection
    enableBottleneckDetection: true,
    
    // Enable performance recommendations
    enableRecommendations: true,
    
    // Number of slowest tests to highlight
    topSlowTests: 10,
    
    // Number of most memory-intensive tests to highlight
    topMemoryTests: 5,
  },

  /**
   * Reporting Settings
   */
  reporting: {
    // Include source maps in CPU profiles (larger files, better debugging)
    includeSourceMaps: false,
    
    // Generate detailed test execution timeline
    enableTimeline: true,
    
    // Include garbage collection statistics
    includeGCStats: true,
    
    // Generate comparison reports (when historical data available)
    enableComparison: true,
  },

  /**
   * Environment-specific overrides
   * 
   * You can override settings based on NODE_ENV or custom environment variables
   */
  environments: {
    development: {
      // More detailed profiling in development
      profiling: {
        sampleInterval: 500,
        enableMemoryProfiling: true,
      },
      flamegraph: {
        width: 1600,
        height: 800,
      },
    },
    
    ci: {
      // Lighter profiling in CI to avoid timeouts
      profiling: {
        enableCPUProfiling: false,
        enableMemoryProfiling: true,
      },
      thresholds: {
        // Stricter thresholds in CI
        slowTestThreshold: 500,
        memoryThreshold: 25,
      },
    },
    
    production: {
      // Minimal profiling in production
      profiling: {
        enableCPUProfiling: false,
        enableMemoryProfiling: false,
      },
      output: {
        flamegraphReport: false,
      },
    },
  },

  /**
   * Get configuration for current environment
   * @returns {Object} Merged configuration for current environment
   */
  getConfig() {
    const env = process.env.NODE_ENV || 'development'
    const envConfig = this.environments[env] || {}
    
    // Deep merge base config with environment-specific overrides
    return this.deepMerge(this, envConfig)
  },

  /**
   * Deep merge utility function
   * @param {Object} target 
   * @param {Object} source 
   * @returns {Object}
   */
  deepMerge(target, source) {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }
}