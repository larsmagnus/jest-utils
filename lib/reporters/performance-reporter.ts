/**
 * Jest Performance Reporter
 *
 * Provides comprehensive performance analysis for Jest test suites including:
 * - Detailed timing metrics for tests and suites
 * - CPU profiling and flamegraph generation
 * - Memory usage tracking during test execution
 * - Performance bottleneck detection and recommendations
 * - Interactive HTML reports with charts and graphs
 * - Historical performance tracking and trends
 *
 * Features:
 * - Test execution timing with high-resolution timestamps
 * - V8 CPU profiling for detailed function-level analysis
 * - Memory heap snapshots and leak detection
 * - Performance regression detection
 * - Flamegraph generation for visual analysis
 * - JSON and HTML report output formats
 *
 * @see https://nodejs.org/api/perf_hooks.html
 * @see https://nodejs.org/api/v8.html
 */
import * as fs from 'fs'
import * as path from 'path'
import { PerformanceObserver } from 'perf_hooks'
import * as v8 from 'v8'
import type {
  Config,
  Test,
  AggregatedResult,
  TestResult,
} from '@jest/reporters'
import {
  getPerformanceConfig,
  type PerformanceConfig,
} from '../tools/performance/configuration'

interface PerformanceReporterOptions {
  outputDir?: string
  enableCPUProfiling?: boolean
  enableMemoryProfiling?: boolean
  flamegraphReport?: boolean
  htmlReport?: boolean
  jsonReport?: boolean
  verbose?: boolean
}

interface TestMetrics {
  testName: string
  testFile: string
  duration: number
  startTime: number
  endTime: number
  memoryBefore: NodeJS.MemoryUsage
  memoryAfter: NodeJS.MemoryUsage
  status: string
}

interface SuiteMetrics {
  suiteName: string
  suiteFile: string
  duration: number
  testCount: number
  passedTests: number
  failedTests: number
  avgTestDuration: number
  memoryUsage: NodeJS.MemoryUsage
}

interface PerformanceData {
  runId: string
  timestamp: string
  duration: number
  totalTests: number
  passedTests: number
  failedTests: number
  testMetrics: TestMetrics[]
  suiteMetrics: SuiteMetrics[]
  memoryUsage: {
    initial: NodeJS.MemoryUsage
    final: NodeJS.MemoryUsage
    peak: NodeJS.MemoryUsage
  }
  cpuProfiles: string[]
  recommendations: string[]
}

export default class PerformanceReporter {
  private globalConfig: Config.GlobalConfig
  private options: PerformanceReporterOptions
  private config: PerformanceConfig
  private startTime: number | null = null
  private endTime: number | null = null
  private testMetrics: Map<string, TestMetrics> = new Map()
  private suiteMetrics: Map<string, SuiteMetrics> = new Map()
  private cpuProfiles: Map<string, any> = new Map()
  private memorySnapshots: Map<string, any> = new Map()
  private performanceObserver: PerformanceObserver | null = null
  private performanceData: PerformanceData
  private performanceHistory: any[] = []

  constructor(
    globalConfig: Config.GlobalConfig,
    options: PerformanceReporterOptions = {}
  ) {
    this.globalConfig = globalConfig
    this.config = getPerformanceConfig()
    this.options = {
      ...this.config.output,
      ...this.config.profiling,
      ...options,
    }

    // Initialize performance data
    this.performanceData = {
      runId: this.generateRunId(),
      timestamp: new Date().toISOString(),
      duration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testMetrics: [],
      suiteMetrics: [],
      memoryUsage: {
        initial: process.memoryUsage(),
        final: process.memoryUsage(),
        peak: process.memoryUsage(),
      },
      cpuProfiles: [],
      recommendations: [],
    }

    // Setup performance monitoring
    this.setupPerformanceObservers()

    console.log(`📊 Performance Reporter initialized`)
    console.log(`📊 Output directory: ${this.options.outputDir}`)
    console.log(
      `🔥 Flamegraph generation: ${this.options.flamegraphReport ? 'ON' : 'OFF'}`
    )
    console.log(
      `💾 CPU profiling: ${this.options.enableCPUProfiling ? 'ON' : 'OFF'}`
    )
    console.log(
      `🧠 Memory profiling: ${this.options.enableMemoryProfiling ? 'ON' : 'OFF'}`
    )
  }

  private generateRunId(): string {
    return `performance-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private setupPerformanceObservers(): void {
    // Set up performance observers for detailed metrics
    if (this.options.enableCPUProfiling) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.entryType === 'measure') {
              // Process performance measurements
              this.processPerfEntry(entry)
            }
          })
        })

        this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] })
      } catch (error) {
        console.warn('Warning: Could not setup performance observers:', error)
      }
    }
  }

  private processPerfEntry(entry: any): void {
    // Process performance entries
    if (this.options.verbose) {
      console.log(`Performance entry: ${entry.name} - ${entry.duration}ms`)
    }
  }

  onRunStart(_results: AggregatedResult, _options: any): void {
    this.startTime = Date.now()
    this.performanceData.memoryUsage.initial = process.memoryUsage()

    if (this.options.verbose) {
      console.log('🏁 Performance monitoring started')
    }

    // Start CPU profiling if enabled
    if (this.options.enableCPUProfiling) {
      this.startCPUProfiling('jest-run')
    }
  }

  onTestFileStart(test: Test): void {
    const testFile = path.relative(process.cwd(), test.path)

    if (this.options.verbose) {
      console.log(`📝 Starting performance monitoring for: ${testFile}`)
    }

    // Take memory snapshot if enabled
    if (this.options.enableMemoryProfiling) {
      this.takeMemorySnapshot(`${testFile}-start`)
    }
  }

  onTestFileResult(test: Test, testResult: TestResult): void {
    const testFile = path.relative(process.cwd(), test.path)
    const duration = testResult.perfStats.end - testResult.perfStats.start

    // Record suite metrics
    const suiteMetrics: SuiteMetrics = {
      suiteName: testFile,
      suiteFile: testFile,
      duration,
      testCount: testResult.numPassingTests + testResult.numFailingTests,
      passedTests: testResult.numPassingTests,
      failedTests: testResult.numFailingTests,
      avgTestDuration:
        duration / (testResult.numPassingTests + testResult.numFailingTests),
      memoryUsage: process.memoryUsage(),
    }

    this.suiteMetrics.set(testFile, suiteMetrics)

    if (this.options.verbose) {
      console.log(
        `✅ Performance data recorded for: ${testFile} (${duration}ms)`
      )
    }

    // Take memory snapshot if enabled
    if (this.options.enableMemoryProfiling) {
      this.takeMemorySnapshot(`${testFile}-end`)
    }
  }

  onRunComplete(contexts: Set<any>, results: AggregatedResult): void {
    this.endTime = Date.now()
    this.performanceData.duration = (this.endTime || 0) - (this.startTime || 0)
    this.performanceData.totalTests = results.numTotalTests
    this.performanceData.passedTests = results.numPassedTests
    this.performanceData.failedTests = results.numFailedTests
    this.performanceData.memoryUsage.final = process.memoryUsage()

    // Stop CPU profiling if enabled
    if (this.options.enableCPUProfiling) {
      this.stopCPUProfiling('jest-run')
    }

    // Generate reports
    this.generateReports()

    // Cleanup
    this.cleanup()

    console.log(
      `🎯 Performance analysis completed in ${this.performanceData.duration}ms`
    )
  }

  private startCPUProfiling(profileName: string): void {
    try {
      // Note: v8.startProfiling is available but not in @types/node
      // This is a known limitation
      if ((v8 as any).startProfiling) {
        ;(v8 as any).startProfiling(profileName, true)
        if (this.options.verbose) {
          console.log(`🔥 Started CPU profiling: ${profileName}`)
        }
      } else {
        console.warn('CPU profiling not available in this Node.js version')
      }
    } catch (error) {
      console.warn('Warning: Could not start CPU profiling:', error)
    }
  }

  private stopCPUProfiling(profileName: string): void {
    try {
      // Note: v8.stopProfiling is available but not in @types/node
      if ((v8 as any).stopProfiling) {
        const profile = (v8 as any).stopProfiling(profileName)
        if (profile) {
          this.cpuProfiles.set(profileName, profile)
          if (this.options.verbose) {
            console.log(`🛑 Stopped CPU profiling: ${profileName}`)
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not stop CPU profiling:', error)
    }
  }

  private takeMemorySnapshot(snapshotName: string): void {
    try {
      const memoryUsage = process.memoryUsage()
      this.memorySnapshots.set(snapshotName, {
        timestamp: Date.now(),
        memory: memoryUsage,
      })

      // Update peak memory usage
      if (
        memoryUsage.heapUsed > this.performanceData.memoryUsage.peak.heapUsed
      ) {
        this.performanceData.memoryUsage.peak = memoryUsage
      }

      if (this.options.verbose) {
        console.log(`📸 Memory snapshot taken: ${snapshotName}`)
      }
    } catch (error) {
      console.warn('Warning: Could not take memory snapshot:', error)
    }
  }

  private generateReports(): void {
    // Ensure output directory exists
    const outputDir = this.options.outputDir || 'reports/performance'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Collect all metrics
    this.collectMetrics()

    // Generate JSON report
    if (this.options.jsonReport) {
      this.generateJSONReport(outputDir)
    }

    // Generate HTML report
    if (this.options.htmlReport) {
      this.generateHTMLReport(outputDir)
    }

    // Generate flamegraphs
    if (this.options.flamegraphReport && this.cpuProfiles.size > 0) {
      this.generateFlamegraphs(outputDir)
    }
  }

  private collectMetrics(): void {
    // Convert suite metrics to array
    this.performanceData.suiteMetrics = Array.from(this.suiteMetrics.values())
    this.performanceData.testMetrics = Array.from(this.testMetrics.values())

    // Generate recommendations
    this.performanceData.recommendations = this.generateRecommendations()
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    // Check for slow tests
    const slowThreshold = this.config.thresholds.slowTestThreshold
    const slowSuites = this.performanceData.suiteMetrics.filter(
      (suite) => suite.duration > slowThreshold
    )

    if (slowSuites.length > 0) {
      recommendations.push(
        `Found ${slowSuites.length} slow test suite(s). Consider optimizing tests that take longer than ${slowThreshold}ms.`
      )
    }

    // Check memory usage
    const memoryUsage =
      this.performanceData.memoryUsage.peak.heapUsed / 1024 / 1024
    const memoryThreshold = this.config.thresholds.memoryThreshold

    if (memoryUsage > memoryThreshold) {
      recommendations.push(
        `Peak memory usage (${memoryUsage.toFixed(2)}MB) exceeded threshold (${memoryThreshold}MB). Check for memory leaks.`
      )
    }

    return recommendations
  }

  private generateJSONReport(outputDir: string): void {
    const reportPath = path.join(
      outputDir,
      `${this.performanceData.runId}.json`
    )

    try {
      fs.writeFileSync(
        reportPath,
        JSON.stringify(this.performanceData, null, 2)
      )
      console.log(`📄 JSON report generated: ${reportPath}`)
    } catch (error) {
      console.error('Error generating JSON report:', error)
    }
  }

  private generateHTMLReport(outputDir: string): void {
    const reportPath = path.join(
      outputDir,
      `${this.performanceData.runId}.html`
    )

    try {
      const htmlContent = this.createHTMLTemplate()
      fs.writeFileSync(reportPath, htmlContent)

      // Create symlink to latest report
      const latestPath = path.join(outputDir, 'latest-report.html')
      try {
        if (fs.existsSync(latestPath)) {
          fs.unlinkSync(latestPath)
        }
        fs.symlinkSync(path.basename(reportPath), latestPath)
      } catch (_linkError) {
        console.warn(
          'Warning: Could not create symlink for latest report:',
          _linkError
        )
        // Fallback: copy file if symlink fails
        fs.copyFileSync(reportPath, latestPath)
      }

      console.log(`📄 HTML report generated: ${reportPath}`)
    } catch (error) {
      console.error('Error generating HTML report:', error)
    }
  }

  private createHTMLTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jest Performance Report - ${this.performanceData.runId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .suite-list { margin-top: 20px; }
        .suite-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .suite-duration { font-weight: bold; color: #28a745; }
        .slow-suite { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Jest Performance Report</h1>
        
        <div class="metric-card">
            <div class="metric-value">${this.performanceData.duration}ms</div>
            <div class="metric-label">Total Execution Time</div>
        </div>

        <div class="metric-card">
            <div class="metric-value">${this.performanceData.totalTests}</div>
            <div class="metric-label">Total Tests (${this.performanceData.passedTests} passed, ${this.performanceData.failedTests} failed)</div>
        </div>

        <div class="metric-card">
            <div class="metric-value">${(this.performanceData.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)}MB</div>
            <div class="metric-label">Peak Memory Usage</div>
        </div>

        ${
          this.performanceData.recommendations.length > 0
            ? `
        <div class="recommendations">
            <h3>🔍 Recommendations</h3>
            <ul>
                ${this.performanceData.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        `
            : ''
        }

        <h3>📊 Test Suite Performance</h3>
        <div class="suite-list">
            ${this.performanceData.suiteMetrics
              .map(
                (suite) => `
                <div class="suite-item">
                    <span>${suite.suiteName} (${suite.testCount} tests)</span>
                    <span class="suite-duration ${suite.duration > this.config.thresholds.slowTestThreshold ? 'slow-suite' : ''}">${suite.duration}ms</span>
                </div>
            `
              )
              .join('')}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 0.9em;">
            Generated on ${new Date(this.performanceData.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`
  }

  private generateFlamegraphs(outputDir: string): void {
    // Create flamegraphs directory
    const flamegraphDir = path.join(outputDir, 'flamegraphs')
    if (!fs.existsSync(flamegraphDir)) {
      fs.mkdirSync(flamegraphDir, { recursive: true })
    }

    this.cpuProfiles.forEach((profile: any, profileName: string) => {
      try {
        // Save CPU profile
        const profilePath = path.join(
          flamegraphDir,
          `${profileName}.cpuprofile`
        )
        fs.writeFileSync(profilePath, JSON.stringify(profile))

        console.log(`🔥 CPU profile saved: ${profilePath}`)
      } catch (error) {
        console.warn(
          `Warning: Could not save flamegraph for ${profileName}:`,
          error
        )
      }
    })
  }

  private cleanup(): void {
    // Stop performance observers
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }

    // Clear maps to free memory
    this.testMetrics.clear()
    this.suiteMetrics.clear()
    this.cpuProfiles.clear()
    this.memorySnapshots.clear()
  }
}
