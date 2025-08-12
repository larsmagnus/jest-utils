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

const fs = require('fs')
const path = require('path')
const { performance, PerformanceObserver } = require('perf_hooks')
const v8 = require('v8')
const { execSync } = require('child_process')

class PerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig
    this.options = {
      // Output configuration
      outputDir: options.output?.outputDir || 'reports/performance',
      htmlReport: options.output?.htmlReport !== false,
      jsonReport: options.output?.jsonReport !== false,
      flamegraphReport: options.output?.flamegraphReport !== false,

      // Profiling configuration
      enableCPUProfiling: options.profiling?.enableCPUProfiling !== false,
      enableMemoryProfiling: options.profiling?.enableMemoryProfiling !== false,
      sampleInterval: options.profiling?.sampleInterval || 1000,

      // Performance thresholds
      slowTestThreshold: options.thresholds?.slowTestThreshold || 1000,
      memoryThreshold: options.thresholds?.memoryThreshold || 50,

      // Historical tracking
      enableTrending: options.trending?.enabled !== false,
      maxHistoryRuns: options.trending?.maxHistoryRuns || 100,

      // Flamegraph configuration
      flamegraphWidth: options.flamegraph?.width || 1200,
      flamegraphHeight: options.flamegraph?.height || 600,

      // Analysis settings
      enableBottleneckDetection:
        options.analysis?.enableBottleneckDetection !== false,
      enableRecommendations: options.analysis?.enableRecommendations !== false,
      topSlowTests: options.analysis?.topSlowTests || 10,
      topMemoryTests: options.analysis?.topMemoryTests || 5,

      ...options,
    }

    this.startTime = null
    this.endTime = null
    this.testMetrics = new Map()
    this.suiteMetrics = new Map()
    this.cpuProfiles = new Map()
    this.memorySnapshots = new Map()

    // Performance tracking storage
    this.performanceData = {
      testRun: {
        id: this.generateRunId(),
        timestamp: new Date().toISOString(),
        config: {
          maxWorkers: globalConfig.maxWorkers,
          testTimeout: globalConfig.testTimeout,
          verbose: globalConfig.verbose,
        },
      },
      suites: [],
      tests: [],
      summary: {},
      profiling: {
        cpu: [],
        memory: [],
      },
    }

    // Setup performance observers
    this.setupPerformanceObservers()

    // Initialize output directory
    this.initializeOutputDirectory()

    // Load historical data for trending
    if (this.options.enableTrending) {
      this.loadHistoricalData()
    }

    console.log(`🚀 Performance Reporter initialized`)
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

  generateRunId() {
    return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  initializeOutputDirectory() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true })
    }

    // Create subdirectories
    const subdirs = [
      'cpu-profiles',
      'memory-snapshots',
      'flamegraphs',
      'html-reports',
    ]
    subdirs.forEach((dir) => {
      const fullPath = path.join(this.options.outputDir, dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    })
  }

  setupPerformanceObservers() {
    // Observe performance marks and measures
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          this.recordPerformanceMeasure(entry)
        }
      })
    })

    this.performanceObserver.observe({ entryTypes: ['measure'] })
  }

  recordPerformanceMeasure(entry) {
    if (entry.name.startsWith('test:')) {
      const testName = entry.name.replace('test:', '')
      if (this.testMetrics.has(testName)) {
        this.testMetrics.get(testName).customMeasures =
          this.testMetrics.get(testName).customMeasures || []
        this.testMetrics.get(testName).customMeasures.push({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
        })
      }
    }
  }

  loadHistoricalData() {
    const historyFile = path.join(
      this.options.outputDir,
      'performance-history.json'
    )
    this.performanceHistory = []

    try {
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf8')
        this.performanceHistory = JSON.parse(data)
      }
    } catch (error) {
      console.warn(
        `Warning: Could not load performance history: ${error.message}`
      )
      this.performanceHistory = []
    }
  }

  saveHistoricalData() {
    if (!this.options.enableTrending) return

    const historyFile = path.join(
      this.options.outputDir,
      'performance-history.json'
    )

    // Add current run to history
    this.performanceHistory.push({
      runId: this.performanceData.testRun.id,
      timestamp: this.performanceData.testRun.timestamp,
      summary: this.performanceData.summary,
    })

    // Trim history to max runs
    if (this.performanceHistory.length > this.options.maxHistoryRuns) {
      this.performanceHistory = this.performanceHistory.slice(
        -this.options.maxHistoryRuns
      )
    }

    try {
      fs.writeFileSync(
        historyFile,
        JSON.stringify(this.performanceHistory, null, 2)
      )
    } catch (error) {
      console.error(`Error saving performance history: ${error.message}`)
    }
  }

  startCPUProfiling(profileName) {
    if (!this.options.enableCPUProfiling) return null

    try {
      // Check if V8 profiling is available
      if (typeof v8.startProfiling === 'function') {
        v8.startProfiling(profileName, true)
        return profileName
      } else {
        // V8 profiling API not available in this Node.js version
        console.warn(
          'CPU profiling not available in this Node.js version. Continuing without CPU profiles.'
        )
        return null
      }
    } catch (error) {
      console.warn(`Could not start CPU profiling: ${error.message}`)
      return null
    }
  }

  stopCPUProfiling(profileName) {
    if (!this.options.enableCPUProfiling || !profileName) return null

    try {
      if (typeof v8.stopProfiling === 'function') {
        const profile = v8.stopProfiling(profileName)
        if (profile) {
          this.cpuProfiles.set(profileName, profile)
          return profile
        }
      }
    } catch (error) {
      console.warn(`Could not stop CPU profiling: ${error.message}`)
    }
    return null
  }

  takeMemorySnapshot(snapshotName) {
    if (!this.options.enableMemoryProfiling) return null

    try {
      const snapshotFile = path.join(
        this.options.outputDir,
        'memory-snapshots',
        `${snapshotName}-${Date.now()}.heapsnapshot`
      )

      console.log(`💾 Taking memory snapshot: ${snapshotFile}`)

      const snapshot = v8.writeHeapSnapshot(snapshotFile)
      this.memorySnapshots.set(snapshotName, {
        file: snapshot,
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage(),
      })
      return snapshot
    } catch (error) {
      console.warn(`Could not take memory snapshot: ${error.message}`)
      return null
    }
  }

  onRunStart(results, options) {
    this.startTime = performance.now()
    this.performanceData.testRun.startTime = this.startTime

    console.log('🏁 Performance profiling started')

    // Start global CPU profiling
    this.globalCPUProfile = this.startCPUProfiling('global-test-run')

    // Take initial memory snapshot
    this.takeMemorySnapshot('initial')

    // Mark performance start
    performance.mark('test-run-start')
  }

  onTestFileStart(test) {
    const filePath = test.path
    const relativePath = path.relative(process.cwd(), filePath)

    // Initialize suite metrics
    const suiteMetrics = {
      file: relativePath,
      startTime: performance.now(),
      tests: [],
      cpuProfile: null,
      memorySnapshots: [],
    }

    this.suiteMetrics.set(filePath, suiteMetrics)

    // Start suite-level CPU profiling
    const profileName = `suite-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`
    suiteMetrics.cpuProfile = this.startCPUProfiling(profileName)

    // Take memory snapshot
    const snapshotName = `suite-start-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`
    this.takeMemorySnapshot(snapshotName)
    suiteMetrics.memorySnapshots.push(snapshotName)

    performance.mark(`suite-start-${relativePath}`)
  }

  onTestCaseStart(test, testCaseStartInfo) {
    const testKey = `${test.path}::${testCaseStartInfo.fullName}`
    const testName = testCaseStartInfo.fullName

    // Initialize test metrics
    const testMetrics = {
      file: path.relative(process.cwd(), test.path),
      name: testName,
      fullName: testCaseStartInfo.fullName,
      ancestorTitles: testCaseStartInfo.ancestorTitles,
      startTime: performance.now(),
      cpuProfile: null,
      memoryBefore: process.memoryUsage(),
      gcBefore: v8.getHeapStatistics(),
    }

    this.testMetrics.set(testKey, testMetrics)

    // Start test-level CPU profiling for slow tests
    const profileName = `test-${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`
    testMetrics.cpuProfile = this.startCPUProfiling(profileName)

    performance.mark(`test-start-${testKey}`)
  }

  onTestCaseResult(test, testCaseResult) {
    const testKey = `${test.path}::${testCaseResult.fullName}`
    const testMetrics = this.testMetrics.get(testKey)

    if (!testMetrics) return

    const endTime = performance.now()
    const duration = endTime - testMetrics.startTime

    // Complete test metrics
    testMetrics.endTime = endTime
    testMetrics.duration = duration
    testMetrics.status = testCaseResult.status
    testMetrics.memoryAfter = process.memoryUsage()
    testMetrics.gcAfter = v8.getHeapStatistics()

    // Calculate memory delta
    testMetrics.memoryDelta = {
      rss: testMetrics.memoryAfter.rss - testMetrics.memoryBefore.rss,
      heapUsed:
        testMetrics.memoryAfter.heapUsed - testMetrics.memoryBefore.heapUsed,
      heapTotal:
        testMetrics.memoryAfter.heapTotal - testMetrics.memoryBefore.heapTotal,
      external:
        testMetrics.memoryAfter.external - testMetrics.memoryBefore.external,
    }

    // Stop CPU profiling
    if (testMetrics.cpuProfile) {
      const profile = this.stopCPUProfiling(testMetrics.cpuProfile)
      if (profile) {
        this.saveCPUProfile(testMetrics.cpuProfile, profile)
      }
    }

    // Mark performance measure
    performance.mark(`test-end-${testKey}`)
    performance.measure(
      `test:${testCaseResult.fullName}`,
      `test-start-${testKey}`,
      `test-end-${testKey}`
    )

    // Check for performance issues
    if (duration > this.options.slowTestThreshold) {
      testMetrics.isSlowTest = true
      console.warn(
        `⚠️  Slow test detected: ${testCaseResult.fullName} (${duration.toFixed(2)}ms)`
      )
    }

    const memoryMB = Math.abs(testMetrics.memoryDelta.heapUsed) / 1024 / 1024
    if (memoryMB > this.options.memoryThreshold) {
      testMetrics.hasMemoryIssue = true
      console.warn(
        `⚠️  High memory usage: ${testCaseResult.fullName} (${memoryMB.toFixed(2)}MB)`
      )
    }
  }

  onTestFileResult(test, testResult) {
    const filePath = test.path
    const relativePath = path.relative(process.cwd(), filePath)
    const suiteMetrics = this.suiteMetrics.get(filePath)

    if (!suiteMetrics) return

    const endTime = performance.now()
    suiteMetrics.endTime = endTime
    suiteMetrics.duration = endTime - suiteMetrics.startTime
    suiteMetrics.result = testResult

    // Stop suite CPU profiling
    if (suiteMetrics.cpuProfile) {
      const profile = this.stopCPUProfiling(suiteMetrics.cpuProfile)
      if (profile) {
        this.saveCPUProfile(suiteMetrics.cpuProfile, profile)
      }
    }

    // Take final memory snapshot for suite
    const snapshotName = `suite-end-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`
    this.takeMemorySnapshot(snapshotName)
    suiteMetrics.memorySnapshots.push(snapshotName)

    // Collect test metrics for this suite
    for (const [testKey, testMetrics] of this.testMetrics) {
      if (testKey.startsWith(filePath + '::')) {
        suiteMetrics.tests.push(testMetrics)
      }
    }

    performance.mark(`suite-end-${relativePath}`)
    performance.measure(
      `suite:${relativePath}`,
      `suite-start-${relativePath}`,
      `suite-end-${relativePath}`
    )
  }

  onRunComplete(contexts, results) {
    this.endTime = performance.now()
    const totalDuration = this.endTime - this.startTime

    console.log('🏁 Performance profiling completed')

    // Stop global CPU profiling
    if (this.globalCPUProfile) {
      const profile = this.stopCPUProfiling(this.globalCPUProfile)
      if (profile) {
        this.saveCPUProfile(this.globalCPUProfile, profile)
      }
    }

    // Take final memory snapshot
    this.takeMemorySnapshot('final')

    // Mark performance end
    performance.mark('test-run-end')
    performance.measure('test-run-total', 'test-run-start', 'test-run-end')

    // Compile performance data
    this.compilePerformanceData(results, totalDuration)

    // Generate reports
    this.generateReports()

    // Save historical data
    this.saveHistoricalData()

    // Clean up
    this.cleanup()

    console.log(
      `📊 Performance reports generated in: ${this.options.outputDir}`
    )
  }

  compilePerformanceData(results, totalDuration) {
    // Compile suite data
    this.performanceData.suites = Array.from(this.suiteMetrics.values())

    // Compile test data
    this.performanceData.tests = Array.from(this.testMetrics.values())

    // Generate summary
    this.performanceData.summary = {
      totalDuration,
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      totalSuites: results.numTotalTestSuites,

      // Performance metrics
      averageTestDuration:
        this.performanceData.tests.reduce(
          (sum, test) => sum + test.duration,
          0
        ) / this.performanceData.tests.length,
      slowestTest: this.performanceData.tests.reduce(
        (slowest, test) =>
          test.duration > (slowest?.duration || 0) ? test : slowest,
        null
      ),
      fastestTest: this.performanceData.tests.reduce(
        (fastest, test) =>
          test.duration < (fastest?.duration || Infinity) ? test : fastest,
        null
      ),

      // Slow tests
      slowTests: this.performanceData.tests.filter((test) => test.isSlowTest),
      memoryIssues: this.performanceData.tests.filter(
        (test) => test.hasMemoryIssue
      ),

      // System metrics
      cpuProfilesGenerated: this.cpuProfiles.size,
      memorySnapshotsGenerated: this.memorySnapshots.size,

      // Recommendations
      recommendations: this.generateRecommendations(),
    }
  }

  generateRecommendations() {
    const recommendations = []

    // Check for slow tests
    const slowTests = this.performanceData.tests.filter(
      (test) => test.isSlowTest
    )
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Tests Detected',
        description: `${slowTests.length} test(s) exceed the slow test threshold (${this.options.slowTestThreshold}ms)`,
        suggestion:
          'Consider optimizing these tests or breaking them into smaller units',
        tests: slowTests.map((test) => ({
          name: test.fullName,
          duration: test.duration,
        })),
      })
    }

    // Check for memory issues
    const memoryIssues = this.performanceData.tests.filter(
      (test) => test.hasMemoryIssue
    )
    if (memoryIssues.length > 0) {
      recommendations.push({
        type: 'memory',
        severity: 'warning',
        title: 'High Memory Usage Detected',
        description: `${memoryIssues.length} test(s) have high memory usage`,
        suggestion:
          'Check for memory leaks, large data structures, or insufficient cleanup',
        tests: memoryIssues.map((test) => ({
          name: test.fullName,
          memoryDelta: Math.abs(test.memoryDelta.heapUsed) / 1024 / 1024,
        })),
      })
    }

    // Check test distribution
    const testCounts = this.performanceData.suites.map(
      (suite) => suite.tests.length
    )
    const maxTests = Math.max(...testCounts)
    const avgTests =
      testCounts.reduce((sum, count) => sum + count, 0) / testCounts.length

    if (maxTests > avgTests * 3) {
      recommendations.push({
        type: 'structure',
        severity: 'info',
        title: 'Uneven Test Distribution',
        description:
          'Some test suites have significantly more tests than others',
        suggestion:
          'Consider splitting large test suites for better parallelization',
      })
    }

    return recommendations
  }

  saveCPUProfile(profileName, profile) {
    try {
      const profilePath = path.join(
        this.options.outputDir,
        'cpu-profiles',
        `${profileName}.cpuprofile`
      )
      fs.writeFileSync(profilePath, JSON.stringify(profile))

      // Generate flamegraph if enabled
      if (this.options.flamegraphReport) {
        this.generateFlamegraph(profileName, profile)
      }
    } catch (error) {
      console.warn(`Could not save CPU profile: ${error.message}`)
    }
  }

  generateFlamegraph(profileName, profile) {
    try {
      // Convert V8 CPU profile to flamegraph format
      const flamegraphData = this.convertProfileToFlamegraph(profile)

      // Save flamegraph data
      const flamegraphPath = path.join(
        this.options.outputDir,
        'flamegraphs',
        `${profileName}.json`
      )
      fs.writeFileSync(flamegraphPath, JSON.stringify(flamegraphData, null, 2))

      // Generate SVG flamegraph if possible
      this.generateSVGFlamegraph(profileName, flamegraphData)
    } catch (error) {
      console.warn(`Could not generate flamegraph: ${error.message}`)
    }
  }

  convertProfileToFlamegraph(profile) {
    // Convert V8 CPU profile to d3-flame-graph compatible format
    const nodes = profile.nodes || []
    const samples = profile.samples || []
    const timeDeltas = profile.timeDeltas || []

    // Build call stacks from samples
    const stacks = []
    let currentTime = profile.startTime || 0

    samples.forEach((sampleNodeId, index) => {
      const timeDelta = timeDeltas[index] || 1
      currentTime += timeDelta

      // Build stack trace for this sample
      const stack = this.buildStackTrace(nodes, sampleNodeId)
      if (stack.length > 0) {
        stacks.push({
          stack: stack.join(';'),
          value: timeDelta,
        })
      }
    })

    // Aggregate stacks
    const aggregated = {}
    stacks.forEach(({ stack, value }) => {
      aggregated[stack] = (aggregated[stack] || 0) + value
    })

    // Convert to flamegraph format
    return Object.entries(aggregated).map(([stack, value]) => ({
      name: stack,
      value,
      children: [],
    }))
  }

  buildStackTrace(nodes, nodeId) {
    const stack = []
    let currentNodeId = nodeId

    while (currentNodeId !== undefined && currentNodeId !== -1) {
      const node = nodes.find((n) => n.id === currentNodeId)
      if (!node) break

      const functionName = node.callFrame.functionName || '(anonymous)'
      const fileName = node.callFrame.url
        ? path.basename(node.callFrame.url)
        : ''
      const location = fileName ? `${functionName} (${fileName})` : functionName

      stack.unshift(location)
      currentNodeId = node.parent
    }

    return stack
  }

  generateSVGFlamegraph(profileName, flamegraphData) {
    // This would typically use a flamegraph generation library
    // For now, we'll create a simple HTML visualization
    const htmlPath = path.join(
      this.options.outputDir,
      'flamegraphs',
      `${profileName}.html`
    )
    const htmlContent = this.generateFlamegraphHTML(profileName, flamegraphData)
    fs.writeFileSync(htmlPath, htmlContent)
  }

  generateFlamegraphHTML(profileName, data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Flamegraph: ${profileName}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3-flame-graph@4"></script>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/d3-flame-graph@4/dist/d3-flamegraph.css">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .chart { margin: 20px 0; }
        .controls { margin: 10px 0; }
    </style>
</head>
<body>
    <h1>CPU Flamegraph: ${profileName}</h1>
    <div class="controls">
        <button onclick="resetZoom()">Reset Zoom</button>
        <button onclick="search()">Search</button>
        <input type="text" id="searchInput" placeholder="Search function names...">
    </div>
    <div id="chart" class="chart"></div>
    
    <script>
        const data = ${JSON.stringify(data)};
        
        const chart = flamegraph()
            .width(${this.options.flamegraphWidth})
            .height(${this.options.flamegraphHeight})
            .cellHeight(18)
            .transitionDuration(750)
            .minFrameSize(5)
            .transitionEase(d3.easeCubic)
            .sort(true)
            .title("")
            .onClick(onClick);

        d3.select("#chart")
            .datum(data)
            .call(chart);

        function onClick(d) {
            console.log("clicked on", d.data.name, d.data.value);
        }

        function resetZoom() {
            chart.resetZoom();
        }

        function search() {
            const term = document.getElementById('searchInput').value;
            chart.search(term);
        }
    </script>
</body>
</html>
    `
  }

  generateReports() {
    const reportData = {
      ...this.performanceData,
      generatedAt: new Date().toISOString(),
      reporterVersion: '1.0.0',
    }

    // Generate JSON report
    if (this.options.jsonReport) {
      const jsonPath = path.join(
        this.options.outputDir,
        `performance-${this.performanceData.testRun.id}.json`
      )
      fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2))
    }

    // Generate HTML report
    if (this.options.htmlReport) {
      const htmlPath = path.join(
        this.options.outputDir,
        'html-reports',
        `performance-${this.performanceData.testRun.id}.html`
      )
      const htmlContent = this.generateHTMLReport(reportData)
      fs.writeFileSync(htmlPath, htmlContent)

      // Generate latest report link
      const latestPath = path.join(this.options.outputDir, 'latest-report.html')
      fs.writeFileSync(latestPath, htmlContent)
    }
  }

  generateHTMLReport(data) {
    const { summary, tests, suites } = data

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Jest Performance Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; margin-top: 5px; }
        .chart-container { margin: 30px 0; padding: 20px; background: white; border-radius: 8px; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        .test-list { max-height: 400px; overflow-y: auto; }
        .test-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            padding: 10px; 
            margin: 5px 0; 
            background: #f8f9fa; 
            border-radius: 4px; 
        }
        .test-name { flex-grow: 1; }
        .test-duration { 
            background: #007acc; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px; 
            margin-left: 10px;
        }
        .slow-test { background: #fff3cd; border-left: 4px solid #ffc107; }
        .memory-issue { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation { 
            background: #d1ecf1; 
            border: 1px solid #bee5eb; 
            border-radius: 4px; 
            padding: 15px; 
            margin: 10px 0; 
        }
        .recommendation.warning { background: #fff3cd; border-color: #ffeaa7; }
        .recommendation.error { background: #f8d7da; border-color: #f5c6cb; }
        .tabs { display: flex; margin-bottom: 20px; }
        .tab { padding: 10px 20px; cursor: pointer; border: none; background: #e9ecef; margin-right: 5px; border-radius: 4px 4px 0 0; }
        .tab.active { background: #007acc; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Jest Performance Report</h1>
            <p>Generated: ${new Date(data.generatedAt).toLocaleString()}</p>
            <p>Run ID: ${data.testRun.id}</p>
        </div>

        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${(summary.totalDuration / 1000).toFixed(2)}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.averageTestDuration.toFixed(2)}ms</div>
                <div class="metric-label">Avg Test Duration</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.slowTests.length}</div>
                <div class="metric-label">Slow Tests</div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('overview')">Overview</button>
            <button class="tab" onclick="showTab('tests')">Test Details</button>
            <button class="tab" onclick="showTab('suites')">Test Suites</button>
            <button class="tab" onclick="showTab('recommendations')">Recommendations</button>
            ${this.options.enableTrending ? '<button class="tab" onclick="showTab(\'trends\')">Trends</button>' : ''}
        </div>

        <div id="overview" class="tab-content active">
            <div class="section">
                <h2>📊 Performance Overview</h2>
                <div class="chart-container">
                    <canvas id="durationChart" width="400" height="200"></canvas>
                </div>
            </div>

            <div class="section">
                <h2>📈 Test Duration Distribution</h2>
                <div class="chart-container">
                    <canvas id="distributionChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>

        <div id="tests" class="tab-content">
            <div class="section">
                <h2>🧪 Test Performance Details</h2>
                <div class="test-list">
                    ${tests
                      .map(
                        (test) => `
                        <div class="test-item ${test.isSlowTest ? 'slow-test' : ''} ${test.hasMemoryIssue ? 'memory-issue' : ''}">
                            <div class="test-name">
                                <strong>${test.name}</strong><br>
                                <small>${test.file}</small>
                            </div>
                            <div class="test-duration">${test.duration.toFixed(2)}ms</div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        </div>

        <div id="suites" class="tab-content">
            <div class="section">
                <h2>📦 Test Suite Performance</h2>
                <div class="chart-container">
                    <canvas id="suiteChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>

        <div id="recommendations" class="tab-content">
            <div class="section">
                <h2>💡 Performance Recommendations</h2>
                ${summary.recommendations
                  .map(
                    (rec) => `
                    <div class="recommendation ${rec.severity}">
                        <h3>${rec.title}</h3>
                        <p>${rec.description}</p>
                        <p><strong>Suggestion:</strong> ${rec.suggestion}</p>
                        ${
                          rec.tests
                            ? `
                            <details>
                                <summary>Affected Tests (${rec.tests.length})</summary>
                                <ul>
                                    ${rec.tests.map((t) => `<li>${t.name} - ${t.duration ? t.duration.toFixed(2) + 'ms' : t.memoryDelta ? t.memoryDelta.toFixed(2) + 'MB' : ''}</li>`).join('')}
                                </ul>
                            </details>
                        `
                            : ''
                        }
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>

        ${
          this.options.enableTrending
            ? `
        <div id="trends" class="tab-content">
            <div class="section">
                <h2>📈 Performance Trends</h2>
                <div class="chart-container">
                    <canvas id="trendChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>
        `
            : ''
        }
    </div>

    <script>
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
        }

        // Generate charts
        const tests = ${JSON.stringify(tests)};
        const suites = ${JSON.stringify(suites)};
        
        // Duration chart
        new Chart(document.getElementById('durationChart'), {
            type: 'bar',
            data: {
                labels: tests.slice(0, 10).map(t => t.name.length > 30 ? t.name.substring(0, 30) + '...' : t.name),
                datasets: [{
                    label: 'Duration (ms)',
                    data: tests.slice(0, 10).map(t => t.duration),
                    backgroundColor: 'rgba(0, 122, 204, 0.6)',
                    borderColor: 'rgba(0, 122, 204, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Distribution chart
        const buckets = [0, 10, 50, 100, 500, 1000, 5000];
        const distribution = buckets.map((bucket, i) => {
            const nextBucket = buckets[i + 1] || Infinity;
            return tests.filter(t => t.duration >= bucket && t.duration < nextBucket).length;
        });

        new Chart(document.getElementById('distributionChart'), {
            type: 'doughnut',
            data: {
                labels: ['0-10ms', '10-50ms', '50-100ms', '100-500ms', '500ms-1s', '1-5s', '5s+'],
                datasets: [{
                    data: distribution,
                    backgroundColor: [
                        '#28a745', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1', '#e83e8c', '#6c757d'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });

        // Suite performance chart
        new Chart(document.getElementById('suiteChart'), {
            type: 'horizontalBar',
            data: {
                labels: suites.map(s => s.file),
                datasets: [{
                    label: 'Duration (ms)',
                    data: suites.map(s => s.duration),
                    backgroundColor: 'rgba(40, 167, 69, 0.6)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { beginAtZero: true }
                }
            }
        });

        ${
          this.options.enableTrending && this.performanceHistory
            ? `
        // Trend chart
        const history = ${JSON.stringify(this.performanceHistory)};
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: history.map(h => new Date(h.timestamp).toLocaleDateString()),
                datasets: [{
                    label: 'Total Duration (s)',
                    data: history.map(h => h.summary.totalDuration / 1000),
                    borderColor: 'rgba(0, 122, 204, 1)',
                    fill: false
                }, {
                    label: 'Avg Test Duration (ms)',
                    data: history.map(h => h.summary.averageTestDuration),
                    borderColor: 'rgba(40, 167, 69, 1)',
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        `
            : ''
        }
    </script>
</body>
</html>
    `
  }

  cleanup() {
    // Clean up performance observers
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }

    // Clear performance marks and measures
    performance.clearMarks()
    performance.clearMeasures()
  }
}

module.exports = PerformanceReporter
