/**
 * Jest Setup File for Automatic Leak Detection
 *
 * This file automatically integrates leak detection into all tests without
 * requiring manual setup in each test file.
 *
 * To use this setup:
 * 1. Add to jest.config.ts: setupFilesAfterEnv: ['<rootDir>/jest.setup.memory.ts']
 * 2. Configure options below as needed
 * 3. Run tests normally - leak detection happens automatically
 */

const LeakDetector = require('./src/leak-detector.ts')

// Configure leak detection options
const leakDetector = new LeakDetector({
  // Memory thresholds
  memoryThresholdMB: 25, // Alert if test increases memory by 25MB
  heapGrowthThreshold: 0.15, // Alert if heap grows by 15%

  // Resource tracking
  trackEventListeners: true,
  trackTimers: true,
  trackGlobals: true,
  trackPromises: false, // Disabled by default as it can be noisy

  // Reporting
  generateHeapSnapshots: process.env.GENERATE_HEAP_SNAPSHOTS === 'true',
  heapSnapshotDir: './heap-snapshots',
  logFile: 'leak-detection.log',
  verbose: process.env.LEAK_DETECTION_VERBOSE === 'true',

  // Test filtering - exclude tests that are known to legitimately use more memory
  excludePatterns: [
    'integration.*large.*dataset',
    'performance.*benchmark',
    '.*stress.*test',
  ],
})

// Global test tracking
let currentTestId = null
const testSummary = new Map()

/**
 * Hook into Jest lifecycle to automatically track tests
 */

// Before each test - start leak detection
beforeEach(() => {
  const testName = expect.getState().currentTestName
  const testFile = expect.getState().testPath

  // Skip if test matches exclude patterns
  const shouldSkip = leakDetector.options.excludePatterns.some((pattern) => {
    const regex = new RegExp(pattern, 'i')
    return regex.test(testName) || regex.test(testFile)
  })

  if (!shouldSkip) {
    currentTestId = leakDetector.startTest(testName, testFile)
  }
})

// After each test - finish leak detection
afterEach(() => {
  if (currentTestId) {
    const testState = expect.getState()
    const status =
      testState.assertionCalls === testState.expectedAssertionsNumber
        ? 'passed'
        : 'failed'

    const metrics = leakDetector.finishTest(currentTestId, status)
    if (metrics) {
      testSummary.set(currentTestId, metrics)
    }

    currentTestId = null
  }
})

// After all tests - generate summary report
afterAll(() => {
  const summary = leakDetector.getSummary()

  if (summary.totalLeaks > 0 || summary.totalWarnings > 0) {
    console.log('\n🔍 LEAK DETECTION SUMMARY')
    console.log('═'.repeat(80))
    console.log(`📊 Tests Analyzed: ${summary.totalTests}`)
    console.log(
      `🚨 Tests with Leaks: ${summary.testsWithLeaks} (${summary.totalLeaks} total leaks)`
    )
    console.log(
      `⚠️  Tests with Warnings: ${summary.testsWithWarnings} (${summary.totalWarnings} total warnings)`
    )

    if (Object.keys(summary.leakTypeBreakdown).length > 0) {
      console.log('\n📈 Leak Type Breakdown:')
      Object.entries(summary.leakTypeBreakdown).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`)
      })
    }

    if (summary.worstOffenders.length > 0) {
      console.log('\n🏆 Worst Offenders:')
      summary.worstOffenders.forEach((offender, index) => {
        console.log(`   ${index + 1}. ${offender.test}`)
        console.log(
          `      Leaks: ${offender.leakCount}, Memory Impact: ${offender.memoryImpact}MB`
        )
      })
    }

    console.log('\n💡 Recommendations:')
    console.log('   • Review tests with HIGH severity leaks first')
    console.log('   • Check leak-detection.log for detailed analysis')
    console.log("   • Use --detectLeaks flag for Jest's built-in detection")
    console.log('   • Set GENERATE_HEAP_SNAPSHOTS=true for heap analysis')
    console.log('═'.repeat(80))
  } else {
    console.log('\n✅ No memory leaks detected in tests!')
  }

  // Clean up detector
  leakDetector.cleanup()
})

// Handle process cleanup
process.on('exit', () => {
  leakDetector.cleanup()
})

// Export for manual usage if needed
module.exports = { leakDetector, testSummary }
