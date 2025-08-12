/**
 * Memory Leak Detection Utility for Jest Tests
 *
 * This utility helps identify tests that leak memory by not properly cleaning up:
 * - Event listeners
 * - Timers (setTimeout, setInterval)
 * - DOM nodes
 * - Global variables
 * - Promises/async operations
 * - File handles
 *
 * Usage:
 * 1. As a Jest setup file (automatic detection)
 * 2. Manual integration in test files
 * 3. As part of custom Jest reporter
 *
 * REFERENCES:
 * - Jest Leak Detection: https://jestjs.io/docs/configuration#detectleaks
 * - V8 Heap Snapshots: https://nodejs.org/api/v8.html#v8_v8_writeheapsnapshot_filename
 * - Memory Management: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management
 */

const fs = require('fs')
const path = require('path')
const v8 = require('v8')

class LeakDetector {
  constructor(options = {}) {
    this.options = {
      // Memory thresholds
      memoryThresholdMB: options.memoryThresholdMB || 50, // Alert if test increases memory by 50MB
      heapGrowthThreshold: options.heapGrowthThreshold || 0.2, // Alert if heap grows by 20%

      // Resource tracking
      trackEventListeners: options.trackEventListeners !== false,
      trackTimers: options.trackTimers !== false,
      trackGlobals: options.trackGlobals !== false,
      trackPromises: options.trackPromises !== false,

      // Reporting
      generateHeapSnapshots: options.generateHeapSnapshots || false,
      heapSnapshotDir: options.heapSnapshotDir || './reports/heap-snapshots',
      logFile: options.logFile || 'leak-detection.log',
      verbose: options.verbose || false,

      // Test filtering
      excludePatterns: options.excludePatterns || [],
      includePatterns: options.includePatterns || [],

      ...options,
    }

    this.testMetrics = new Map()
    this.globalState = {
      initialHeap: null,
      initialGlobals: null,
      currentTest: null,
    }

    this.setupGlobalHooks()
  }

  /**
   * Set up global monitoring hooks
   */
  setupGlobalHooks() {
    // Track initial global state
    this.globalState.initialGlobals = this.captureGlobalState()
    this.globalState.initialHeap = this.getMemoryUsage()

    if (this.options.generateHeapSnapshots) {
      this.ensureHeapSnapshotDir()
    }
  }

  /**
   * Start monitoring a test
   * @param {string} testName - Full test name
   * @param {string} testFile - Test file path
   */
  startTest(testName, testFile) {
    const testId = `${testFile} > ${testName}`
    this.globalState.currentTest = testId

    const metrics = {
      testName,
      testFile,
      startTime: Date.now(),
      initialMemory: this.getMemoryUsage(),
      initialGlobals: this.captureGlobalState(),
      initialTimers: this.captureTimerState(),
      initialEventListeners: this.captureEventListenerState(),
      leaksDetected: [],
      warnings: [],
    }

    this.testMetrics.set(testId, metrics)

    if (this.options.verbose) {
      this.log(`🔍 Leak detection started for: ${testName}`)
    }

    return testId
  }

  /**
   * Finish monitoring a test and analyze for leaks
   * @param {string} testId - Test identifier
   * @param {string} status - Test status (passed, failed, etc.)
   */
  finishTest(testId, status) {
    const metrics = this.testMetrics.get(testId)
    if (!metrics) {
      this.log(`Warning: No metrics found for test ${testId}`, 'WARN')
      return null
    }

    // Capture final state
    metrics.endTime = Date.now()
    metrics.finalMemory = this.getMemoryUsage()
    metrics.finalGlobals = this.captureGlobalState()
    metrics.finalTimers = this.captureTimerState()
    metrics.finalEventListeners = this.captureEventListenerState()
    metrics.status = status
    metrics.duration = metrics.endTime - metrics.startTime

    // Analyze for leaks
    this.analyzeMemoryLeak(metrics)
    this.analyzeGlobalLeak(metrics)
    this.analyzeTimerLeak(metrics)
    this.analyzeEventListenerLeak(metrics)

    // Generate heap snapshot if requested and leaks detected
    if (
      this.options.generateHeapSnapshots &&
      metrics.leaksDetected.length > 0
    ) {
      this.generateHeapSnapshot(testId)
    }

    if (metrics.leaksDetected.length > 0 || metrics.warnings.length > 0) {
      this.reportLeaks(metrics)
    }

    this.globalState.currentTest = null
    return metrics
  }

  /**
   * Analyze memory usage for leaks
   * @param {Object} metrics - Test metrics
   */
  analyzeMemoryLeak(metrics) {
    const memoryDiff =
      metrics.finalMemory.heapUsed - metrics.initialMemory.heapUsed
    const memoryDiffMB = memoryDiff / (1024 * 1024)
    const heapGrowthRate = memoryDiff / metrics.initialMemory.heapUsed

    if (memoryDiffMB > this.options.memoryThresholdMB) {
      metrics.leaksDetected.push({
        type: 'MEMORY_LEAK',
        severity: 'HIGH',
        message: `Memory increased by ${memoryDiffMB.toFixed(
          2
        )}MB (threshold: ${this.options.memoryThresholdMB}MB)`,
        details: {
          initialHeapUsed: metrics.initialMemory.heapUsed,
          finalHeapUsed: metrics.finalMemory.heapUsed,
          difference: memoryDiff,
          growthRate: heapGrowthRate,
        },
      })
    } else if (heapGrowthRate > this.options.heapGrowthThreshold) {
      metrics.warnings.push({
        type: 'MEMORY_GROWTH',
        severity: 'MEDIUM',
        message: `Heap grew by ${(heapGrowthRate * 100).toFixed(
          1
        )}% (threshold: ${this.options.heapGrowthThreshold * 100}%)`,
        details: {
          growthRate: heapGrowthRate,
          memoryDiffMB: memoryDiffMB,
        },
      })
    }
  }

  /**
   * Analyze global variables for leaks
   * @param {Object} metrics - Test metrics
   */
  analyzeGlobalLeak(metrics) {
    if (!this.options.trackGlobals) return

    const newGlobals = this.diffGlobalState(
      metrics.initialGlobals,
      metrics.finalGlobals
    )

    if (newGlobals.length > 0) {
      const severity = newGlobals.length > 5 ? 'HIGH' : 'MEDIUM'
      metrics.leaksDetected.push({
        type: 'GLOBAL_VARIABLE_LEAK',
        severity,
        message: `${newGlobals.length} new global variable(s) detected`,
        details: {
          newGlobals: newGlobals.slice(0, 10), // Limit to first 10 for readability
          totalCount: newGlobals.length,
        },
      })
    }
  }

  /**
   * Analyze timers for leaks
   * @param {Object} metrics - Test metrics
   */
  analyzeTimerLeak(metrics) {
    if (!this.options.trackTimers) return

    const timerDiff = metrics.finalTimers.count - metrics.initialTimers.count

    if (timerDiff > 0) {
      metrics.leaksDetected.push({
        type: 'TIMER_LEAK',
        severity: timerDiff > 5 ? 'HIGH' : 'MEDIUM',
        message: `${timerDiff} timer(s) not cleaned up`,
        details: {
          initialCount: metrics.initialTimers.count,
          finalCount: metrics.finalTimers.count,
          leakedTimers: timerDiff,
        },
      })
    }
  }

  /**
   * Analyze event listeners for leaks
   * @param {Object} metrics - Test metrics
   */
  analyzeEventListenerLeak(metrics) {
    if (!this.options.trackEventListeners) return

    const listenerDiff =
      metrics.finalEventListeners.count - metrics.initialEventListeners.count

    if (listenerDiff > 0) {
      metrics.leaksDetected.push({
        type: 'EVENT_LISTENER_LEAK',
        severity: listenerDiff > 10 ? 'HIGH' : 'MEDIUM',
        message: `${listenerDiff} event listener(s) not removed`,
        details: {
          initialCount: metrics.initialEventListeners.count,
          finalCount: metrics.finalEventListeners.count,
          leakedListeners: listenerDiff,
        },
      })
    }
  }

  /**
   * Get current memory usage
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage() {
    const usage = process.memoryUsage()
    return {
      ...usage,
      timestamp: Date.now(),
    }
  }

  /**
   * Capture current global state
   * @returns {Set} Set of global property names
   */
  captureGlobalState() {
    if (typeof window !== 'undefined') {
      // Browser environment
      return new Set(Object.getOwnPropertyNames(window))
    } else {
      // Node.js environment
      return new Set(Object.getOwnPropertyNames(global))
    }
  }

  /**
   * Compare global states and find new variables
   * @param {Set} initial - Initial global state
   * @param {Set} final - Final global state
   * @returns {Array} Array of new global variable names
   */
  diffGlobalState(initial, final) {
    const newGlobals = []
    for (const prop of final) {
      if (!initial.has(prop)) {
        newGlobals.push(prop)
      }
    }
    return newGlobals
  }

  /**
   * Capture current timer state (approximate)
   * @returns {Object} Timer state information
   */
  captureTimerState() {
    // This is an approximation since Node.js doesn't expose active timer count directly
    // In a real implementation, you might monkey-patch setTimeout/setInterval
    return {
      count:
        process._getActiveHandles().length +
        process._getActiveRequests().length,
      timestamp: Date.now(),
    }
  }

  /**
   * Capture current event listener state (approximate)
   * @returns {Object} Event listener state information
   */
  captureEventListenerState() {
    let count = 0

    if (typeof window !== 'undefined' && window.document) {
      // Browser environment - count DOM event listeners (limited visibility)
      count = document.querySelectorAll('*').length // Rough approximation
    } else {
      // Node.js environment - count EventEmitter listeners
      const _EventEmitter = require('events')
      count = process.listenerCount
        ? Object.keys(process._events || {}).length
        : 0
    }

    return {
      count,
      timestamp: Date.now(),
    }
  }

  /**
   * Generate heap snapshot for analysis
   * @param {string} testId - Test identifier
   */
  generateHeapSnapshot(testId) {
    try {
      const sanitizedTestId = testId.replace(/[^a-zA-Z0-9-_]/g, '_')
      const filename = `heap-${sanitizedTestId}-${Date.now()}.heapsnapshot`
      const filepath = path.join(this.options.heapSnapshotDir, filename)

      v8.writeHeapSnapshot(filepath)
      this.log(`💾 Heap snapshot saved: ${filepath}`)
    } catch (error) {
      this.log(`Error generating heap snapshot: ${error.message}`, 'ERROR')
    }
  }

  /**
   * Ensure heap snapshot directory exists
   */
  ensureHeapSnapshotDir() {
    try {
      if (!fs.existsSync(this.options.heapSnapshotDir)) {
        fs.mkdirSync(this.options.heapSnapshotDir, { recursive: true })
      }
    } catch (error) {
      this.log(
        `Error creating heap snapshot directory: ${error.message}`,
        'ERROR'
      )
    }
  }

  /**
   * Report detected leaks
   * @param {Object} metrics - Test metrics with leak information
   */
  reportLeaks(metrics) {
    const testName = `${metrics.testFile} > ${metrics.testName}`

    this.log(`🚨 LEAK DETECTION REPORT: ${testName}`, 'WARN')
    this.log('─'.repeat(80))

    // Report leaks
    if (metrics.leaksDetected.length > 0) {
      this.log(`❌ ${metrics.leaksDetected.length} leak(s) detected:`, 'ERROR')
      metrics.leaksDetected.forEach((leak, index) => {
        this.log(
          `   ${index + 1}. [${leak.severity}] ${leak.type}: ${leak.message}`,
          'ERROR'
        )
        if (this.options.verbose && leak.details) {
          this.log(
            `      Details: ${JSON.stringify(leak.details, null, 2)}`,
            'ERROR'
          )
        }
      })
    }

    // Report warnings
    if (metrics.warnings.length > 0) {
      this.log(`⚠️  ${metrics.warnings.length} warning(s):`, 'WARN')
      metrics.warnings.forEach((warning, index) => {
        this.log(
          `   ${index + 1}. [${warning.severity}] ${warning.type}: ${
            warning.message
          }`,
          'WARN'
        )
      })
    }

    // Memory summary
    const memoryDiff =
      metrics.finalMemory.heapUsed - metrics.initialMemory.heapUsed
    const memoryDiffMB = (memoryDiff / (1024 * 1024)).toFixed(2)
    this.log(`📊 Memory Impact: ${memoryDiffMB}MB change`)
    this.log(`⏱️  Test Duration: ${metrics.duration}ms`)

    this.log('─'.repeat(80))
    this.log('💡 Leak Prevention Tips:')
    this.log('   • Clear timers: clearTimeout(), clearInterval()')
    this.log('   • Remove event listeners: removeEventListener()')
    this.log('   • Clean up DOM nodes: remove(), cleanup libraries')
    this.log('   • Cancel pending promises/requests')
    this.log('   • Reset global variables in afterEach()')
    this.log('   • Use Jest --detectLeaks for built-in detection')
    this.log('─'.repeat(80))
  }

  /**
   * Get summary of all detected leaks
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const allMetrics = Array.from(this.testMetrics.values())
    const testsWithLeaks = allMetrics.filter((m) => m.leaksDetected.length > 0)
    const testsWithWarnings = allMetrics.filter((m) => m.warnings.length > 0)

    const leakTypes = {}
    allMetrics.forEach((metrics) => {
      metrics.leaksDetected.forEach((leak) => {
        leakTypes[leak.type] = (leakTypes[leak.type] || 0) + 1
      })
    })

    return {
      totalTests: allMetrics.length,
      testsWithLeaks: testsWithLeaks.length,
      testsWithWarnings: testsWithWarnings.length,
      totalLeaks: allMetrics.reduce(
        (sum, m) => sum + m.leaksDetected.length,
        0
      ),
      totalWarnings: allMetrics.reduce((sum, m) => sum + m.warnings.length, 0),
      leakTypeBreakdown: leakTypes,
      worstOffenders: testsWithLeaks
        .sort((a, b) => b.leaksDetected.length - a.leaksDetected.length)
        .slice(0, 5)
        .map((m) => ({
          test: `${m.testFile} > ${m.testName}`,
          leakCount: m.leaksDetected.length,
          memoryImpact: (
            (m.finalMemory.heapUsed - m.initialMemory.heapUsed) /
            (1024 * 1024)
          ).toFixed(2),
        })),
    }
  }

  /**
   * Clean up and reset detector state
   */
  cleanup() {
    this.testMetrics.clear()
    this.globalState.currentTest = null
  }

  /**
   * Log message with timestamp
   * @param {string} message - Message to log
   * @param {string} level - Log level
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${level}] ${message}`

    if (this.options.verbose || level !== 'INFO') {
      console.log(logEntry)
    }

    // Append to log file
    try {
      fs.appendFileSync(this.options.logFile, logEntry + '\n')
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`)
    }
  }
}

module.exports = LeakDetector
