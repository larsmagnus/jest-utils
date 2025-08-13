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

import * as fs from 'fs'
import * as path from 'path'
import * as v8 from 'v8'

interface LeakDetectorOptions {
  memoryThresholdMB?: number
  heapGrowthThreshold?: number
  trackEventListeners?: boolean
  trackTimers?: boolean
  trackGlobals?: boolean
  trackPromises?: boolean
  generateHeapSnapshots?: boolean
  heapSnapshotDir?: string
  logFile?: string
  verbose?: boolean
  excludePatterns?: string[]
  includePatterns?: string[]
}

interface TestSnapshot {
  testId: string
  testName: string
  testFile: string
  startTime: number
  memoryUsage: NodeJS.MemoryUsage
  heapUsed: number
  globalVarCount: number
  timers: Set<any>
  eventListeners: Map<any, any[]>
  promises: Set<Promise<any>>
}

interface TestMetrics {
  testName: string
  testFile: string
  startTime: number
  endTime?: number
  duration?: number
  status?: string
  initialMemory: MemoryUsageWithTimestamp
  finalMemory?: MemoryUsageWithTimestamp
  initialGlobals: Set<string>
  finalGlobals?: Set<string>
  initialTimers: TimerState
  finalTimers?: TimerState
  initialEventListeners: EventListenerState
  finalEventListeners?: EventListenerState
  leaksDetected: LeakReport[]
  warnings: LeakReport[]
}

interface MemoryUsageWithTimestamp extends NodeJS.MemoryUsage {
  timestamp: number
}

interface TimerState {
  count: number
  timestamp: number
}

interface EventListenerState {
  count: number
  timestamp: number
}

interface LeakSummary {
  totalTests: number
  testsWithLeaks: number
  testsWithWarnings: number
  totalLeaks: number
  totalWarnings: number
  leakTypeBreakdown: Record<string, number>
  worstOffenders: Array<{
    test: string
    leakCount: number
    memoryImpact: string
  }>
}

interface LeakReport {
  type: string
  severity: 'low' | 'medium' | 'high'
  message: string
  details?: any
  recommendation: string
}

export class LeakDetector {
  private options: Required<LeakDetectorOptions>
  private activeTests: Map<string, TestSnapshot> = new Map()
  private testHistory: TestMetrics[] = []
  private originalGlobalKeys: Set<string>
  private globalTimerMethods: any
  private leakReports: LeakReport[] = []
  private testMetrics: Map<string, TestMetrics> = new Map()
  private globalState: {
    initialHeap: NodeJS.MemoryUsage | null
    initialGlobals: Set<string> | null
    currentTest: string | null
  }

  constructor(options: LeakDetectorOptions = {}) {
    this.options = {
      // Memory thresholds
      memoryThresholdMB: options.memoryThresholdMB ?? 50, // Alert if test increases memory by 50MB
      heapGrowthThreshold: options.heapGrowthThreshold ?? 0.2, // Alert if heap grows by 20%

      // Resource tracking
      trackEventListeners: options.trackEventListeners !== false,
      trackTimers: options.trackTimers !== false,
      trackGlobals: options.trackGlobals !== false,
      trackPromises: options.trackPromises !== false,

      // Reporting
      generateHeapSnapshots: options.generateHeapSnapshots ?? false,
      heapSnapshotDir: options.heapSnapshotDir ?? './reports/heap-snapshots',
      logFile: options.logFile ?? 'leak-detection.log',
      verbose: options.verbose ?? false,

      // Test filtering
      excludePatterns: options.excludePatterns ?? [],
      includePatterns: options.includePatterns ?? [],
    }

    this.globalState = {
      initialHeap: null,
      initialGlobals: null,
      currentTest: null,
    }

    this.originalGlobalKeys = new Set()
    this.setupGlobalHooks()
  }

  /**
   * Set up global monitoring hooks
   */
  private setupGlobalHooks(): void {
    // Track initial global state
    this.globalState.initialGlobals = this.captureGlobalState()
    this.globalState.initialHeap = this.getMemoryUsage()

    if (this.options.generateHeapSnapshots) {
      this.ensureHeapSnapshotDir()
    }
  }

  /**
   * Get exclude patterns for external access
   */
  getExcludePatterns(): string[] {
    return this.options.excludePatterns
  }

  /**
   * Start monitoring a test
   * @param testName - Full test name
   * @param testFile - Test file path
   */
  public startTest(testName: string, testFile: string): string {
    const testId = `${testFile} > ${testName}`
    this.globalState.currentTest = testId

    const metrics: TestMetrics = {
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
   * @param testId - Test identifier
   * @param status - Test status (passed, failed, etc.)
   */
  public finishTest(testId: string, status: string): TestMetrics | null {
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
   * @param metrics - Test metrics
   */
  private analyzeMemoryLeak(metrics: TestMetrics): void {
    if (!metrics.finalMemory) return

    const memoryDiff =
      metrics.finalMemory.heapUsed - metrics.initialMemory.heapUsed
    const memoryDiffMB = memoryDiff / (1024 * 1024)
    const heapGrowthRate = memoryDiff / metrics.initialMemory.heapUsed

    if (memoryDiffMB > this.options.memoryThresholdMB) {
      metrics.leaksDetected.push({
        type: 'MEMORY_LEAK',
        severity: 'high',
        message: `Memory increased by ${memoryDiffMB.toFixed(
          2
        )}MB (threshold: ${this.options.memoryThresholdMB}MB)`,
        details: {
          initialHeapUsed: metrics.initialMemory.heapUsed,
          finalHeapUsed: metrics.finalMemory.heapUsed,
          difference: memoryDiff,
          growthRate: heapGrowthRate,
        },
        recommendation:
          'Check for objects being retained in memory, consider using WeakMap/WeakSet for references',
      })
    } else if (heapGrowthRate > this.options.heapGrowthThreshold) {
      metrics.warnings.push({
        type: 'MEMORY_GROWTH',
        severity: 'medium',
        message: `Heap grew by ${(heapGrowthRate * 100).toFixed(
          1
        )}% (threshold: ${this.options.heapGrowthThreshold * 100}%)`,
        details: {
          growthRate: heapGrowthRate,
          memoryDiffMB: memoryDiffMB,
        },
        recommendation:
          'Monitor memory usage patterns and consider optimizing object creation',
      })
    }
  }

  /**
   * Analyze global variables for leaks
   * @param metrics - Test metrics
   */
  private analyzeGlobalLeak(metrics: TestMetrics): void {
    if (!this.options.trackGlobals || !metrics.finalGlobals) return

    const newGlobals = this.diffGlobalState(
      metrics.initialGlobals,
      metrics.finalGlobals
    )

    if (newGlobals.length > 0) {
      const severity = newGlobals.length > 5 ? 'high' : 'medium'
      metrics.leaksDetected.push({
        type: 'GLOBAL_VARIABLE_LEAK',
        severity,
        message: `${newGlobals.length} new global variable(s) detected`,
        details: {
          newGlobals: newGlobals.slice(0, 10), // Limit to first 10 for readability
          totalCount: newGlobals.length,
        },
        recommendation:
          'Clean up global variables in afterEach hooks or use proper scoping',
      })
    }
  }

  /**
   * Analyze timers for leaks
   * @param metrics - Test metrics
   */
  private analyzeTimerLeak(metrics: TestMetrics): void {
    if (!this.options.trackTimers || !metrics.finalTimers) return

    const timerDiff = metrics.finalTimers.count - metrics.initialTimers.count

    if (timerDiff > 0) {
      metrics.leaksDetected.push({
        type: 'TIMER_LEAK',
        severity: timerDiff > 5 ? 'high' : 'medium',
        message: `${timerDiff} timer(s) not cleaned up`,
        details: {
          initialCount: metrics.initialTimers.count,
          finalCount: metrics.finalTimers.count,
          leakedTimers: timerDiff,
        },
        recommendation:
          'Use clearTimeout() and clearInterval() to clean up timers',
      })
    }
  }

  /**
   * Analyze event listeners for leaks
   * @param metrics - Test metrics
   */
  private analyzeEventListenerLeak(metrics: TestMetrics): void {
    if (!this.options.trackEventListeners || !metrics.finalEventListeners)
      return

    const listenerDiff =
      metrics.finalEventListeners.count - metrics.initialEventListeners.count

    if (listenerDiff > 0) {
      metrics.leaksDetected.push({
        type: 'EVENT_LISTENER_LEAK',
        severity: listenerDiff > 10 ? 'high' : 'medium',
        message: `${listenerDiff} event listener(s) not removed`,
        details: {
          initialCount: metrics.initialEventListeners.count,
          finalCount: metrics.finalEventListeners.count,
          leakedListeners: listenerDiff,
        },
        recommendation:
          'Use removeEventListener() or AbortController to clean up event listeners',
      })
    }
  }

  /**
   * Get current memory usage
   * @returns Memory usage statistics
   */
  private getMemoryUsage(): MemoryUsageWithTimestamp {
    const usage = process.memoryUsage()
    return {
      ...usage,
      timestamp: Date.now(),
    }
  }

  /**
   * Capture current global state
   * @returns Set of global property names
   */
  private captureGlobalState(): Set<string> {
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
   * @param initial - Initial global state
   * @param final - Final global state
   * @returns Array of new global variable names
   */
  private diffGlobalState(initial: Set<string>, final: Set<string>): string[] {
    const newGlobals: string[] = []
    final.forEach((prop) => {
      if (!initial.has(prop)) {
        newGlobals.push(prop)
      }
    })
    return newGlobals
  }

  /**
   * Capture current timer state (approximate)
   * @returns Timer state information
   */
  private captureTimerState(): TimerState {
    // This is an approximation since Node.js doesn't expose active timer count directly
    // In a real implementation, you might monkey-patch setTimeout/setInterval
    return {
      count:
        (process as any)._getActiveHandles().length +
        (process as any)._getActiveRequests().length,
      timestamp: Date.now(),
    }
  }

  /**
   * Capture current event listener state (approximate)
   * @returns Event listener state information
   */
  private captureEventListenerState(): EventListenerState {
    let count = 0

    if (typeof window !== 'undefined' && window.document) {
      // Browser environment - count DOM event listeners (limited visibility)
      count = document.querySelectorAll('*').length // Rough approximation
    } else {
      // Node.js environment - count EventEmitter listeners
      count =
        typeof process.listenerCount === 'function'
          ? Object.keys((process as any)._events || {}).length
          : 0
    }

    return {
      count,
      timestamp: Date.now(),
    }
  }

  /**
   * Generate heap snapshot for analysis
   * @param testId - Test identifier
   */
  private generateHeapSnapshot(testId: string): void {
    try {
      const sanitizedTestId = testId.replace(/[^a-zA-Z0-9-_]/g, '_')
      const filename = `heap-${sanitizedTestId}-${Date.now()}.heapsnapshot`
      const filepath = path.join(this.options.heapSnapshotDir, filename)

      v8.writeHeapSnapshot(filepath)
      this.log(`💾 Heap snapshot saved: ${filepath}`)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.log(`Error generating heap snapshot: ${errorMessage}`, 'ERROR')
    }
  }

  /**
   * Ensure heap snapshot directory exists
   */
  private ensureHeapSnapshotDir(): void {
    try {
      if (!fs.existsSync(this.options.heapSnapshotDir)) {
        fs.mkdirSync(this.options.heapSnapshotDir, { recursive: true })
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.log(
        `Error creating heap snapshot directory: ${errorMessage}`,
        'ERROR'
      )
    }
  }

  /**
   * Report detected leaks
   * @param metrics - Test metrics with leak information
   */
  private reportLeaks(metrics: TestMetrics): void {
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
    if (metrics.finalMemory) {
      const memoryDiff =
        metrics.finalMemory.heapUsed - metrics.initialMemory.heapUsed
      const memoryDiffMB = (memoryDiff / (1024 * 1024)).toFixed(2)
      this.log(`📊 Memory Impact: ${memoryDiffMB}MB change`)
    }
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
   * @returns Summary statistics
   */
  public getSummary(): LeakSummary {
    const allMetrics = Array.from(this.testMetrics.values())
    const testsWithLeaks = allMetrics.filter((m) => m.leaksDetected.length > 0)
    const testsWithWarnings = allMetrics.filter((m) => m.warnings.length > 0)

    const leakTypes: Record<string, number> = {}
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
          memoryImpact: m.finalMemory
            ? (
                (m.finalMemory.heapUsed - m.initialMemory.heapUsed) /
                (1024 * 1024)
              ).toFixed(2)
            : 'N/A',
        })),
    }
  }

  /**
   * Clean up and reset detector state
   */
  public cleanup(): void {
    this.testMetrics.clear()
    this.globalState.currentTest = null
  }

  /**
   * Log message with timestamp
   * @param message - Message to log
   * @param level - Log level
   */
  private log(message: string, level: string = 'INFO'): void {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${level}] ${message}`

    if (this.options.verbose || level !== 'INFO') {
      console.log(logEntry)
    }

    // Append to log file
    try {
      fs.appendFileSync(this.options.logFile, logEntry + '\n')
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`Failed to write to log file: ${errorMessage}`)
    }
  }
}

export default LeakDetector
export {
  type LeakDetectorOptions,
  type TestMetrics,
  type LeakReport,
  type LeakSummary,
}
