/**
 * Custom Jest Reporter
 *
 * This reporter logs detailed information about test runs throughout the entire Jest lifecycle.
 * It demonstrates all major hooks available in Jest's reporter API and provides insights
 * into test execution phases, timing, and results.
 *
 * Jest Reporter Lifecycle:
 * 1. onRunStart - Called at the beginning of the test run
 * 2. onTestFileStart - Called when a test file starts running
 * 3. onTestCaseStart - Called when an individual test case starts
 * 4. onTestCaseResult - Called when an individual test case completes
 * 5. onTestFileResult - Called when a test file completes
 * 6. onRunComplete - Called at the end of the entire test run
 *
 * Additional hooks available:
 * - onTestStart - Called when a test starts (similar to onTestCaseStart)
 * - onTestResult - Called when a test completes (similar to onTestCaseResult)
 *
 * @see https://jestjs.io/docs/configuration#reporters
 */

const fs = require("fs");
const path = require("path");
const LeakDetector = require("../utils/leak-detector");
const leakConfig = require("../leak-detection.config");

class CustomReporter {
  constructor(globalConfig, options) {
    /**
     * Store global configuration and reporter options
     * @param {Object} globalConfig - Jest's global configuration
     * @param {Object} options - Reporter-specific options from jest config
     */
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.startTime = null;
    this.testResults = [];

    // Track test file environments to work around Jest's multi-project environment issue
    //
    // ISSUE: In Jest's multi-project setup, the test.context.config.testEnvironment
    // property in onTestCaseStart can reference the wrong project's configuration,
    // typically defaulting to the last project's environment rather than the
    // environment of the currently executing test.
    //
    // ROOT CAUSE: Jest's reporter hooks share context objects across projects,
    // and the test.context.config can become stale or reference a different
    // project's configuration by the time onTestCaseStart is called. This is
    // due to Jest's internal project runner and worker pool management.
    //
    // SOLUTION: Store the correct environment from onTestFileStart (where it's
    // accurate) and use it later in onTestCaseStart for proper reporting.
    //
    // REFERENCES:
    // - Jest Multi-Project: https://jestjs.io/docs/configuration#projects
    // - Jest Reporter API: https://jestjs.io/docs/configuration#reporters
    // - Related Issue: https://github.com/facebook/jest/issues/6565
    // - Jest Runner Context: https://github.com/facebook/jest/blob/main/packages/jest-runner/src/runTest.ts
    this.testFileEnvironments = new Map();

    // Flaky test tracking - maintains test execution history to identify inconsistent tests
    //
    // FLAKY TEST DETECTION: Tests that pass sometimes and fail other times are "flaky"
    // and can indicate race conditions, timing issues, or environmental dependencies.
    //
    // STRATEGY: Track test results across multiple runs using a persistent history file.
    // Tests with mixed pass/fail results over time are flagged as potentially flaky.
    //
    // IMPLEMENTATION:
    // 1. Load previous test history from file
    // 2. Track current run results
    // 3. Analyze patterns to detect flakiness
    // 4. Report flaky tests and save updated history
    //
    // REFERENCES:
    // - Google's Flaky Test Research: https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html
    // - Jest Retry Configuration: https://jestjs.io/docs/jest-object#jestretrytimes
    this.flakyTracker = this.initializeFlakyTracker();

    // Memory leak detection - tracks resource usage and identifies memory leaks
    //
    // LEAK DETECTION: Tests that don't properly clean up resources can cause memory leaks
    // leading to performance degradation and eventual application crashes.
    //
    // STRATEGY: Monitor memory usage, global variables, timers, and event listeners
    // before and after each test to identify cleanup issues.
    //
    // IMPLEMENTATION:
    // 1. Track initial state before test execution
    // 2. Monitor resource usage during test
    // 3. Analyze final state and detect leaks
    // 4. Report findings with actionable recommendations
    //
    // REFERENCES:
    // - Jest Leak Detection: https://jestjs.io/docs/configuration#detectleaks
    // - Memory Management: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management
    // - V8 Heap Profiling: https://nodejs.org/api/v8.html
    this.leakDetector = this.options.enableLeakDetection !== false ? 
      new LeakDetector({
        ...leakConfig.getConfig(),
        ...this.options.leakDetection,
        verbose: this.verbose
      }) : null;

    // Configuration for logging
    this.logFile = this.options.logFile || "test-report.log";

    // Only enable verbose mode if Jest's --verbose flag is set
    // Check both globalConfig.verbose and options.verbose (for explicit override)
    this.verbose =
      this.options.verbose === true || globalConfig.verbose === true;

    this.log("🚀 Custom Reporter initialized");
    this.log(`📊 Logging to: ${this.logFile}`);
    this.log(`🔍 Verbose mode: ${this.verbose ? "ON" : "OFF"}`);
  }

  /**
   * Initialize flaky test tracking system
   * @returns {Object} Flaky tracker with methods and data
   */
  initializeFlakyTracker() {
    const historyFile =
      this.options.flakyHistoryFile || "flaky-test-history.json";
    const maxHistoryRuns = this.options.maxHistoryRuns || 50; // Keep last 50 runs
    const flakyThreshold = this.options.flakyThreshold || 0.2; // 20% failure rate = flaky

    // Load existing test history
    let history = {};
    try {
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, "utf8");
        history = JSON.parse(data);
      }
    } catch (error) {
      this.log(
        `Warning: Could not load flaky test history: ${error.message}`,
        "WARN"
      );
      history = {};
    }

    return {
      historyFile,
      maxHistoryRuns,
      flakyThreshold,
      history,
      currentRun: {
        timestamp: new Date().toISOString(),
        tests: new Map(), // testFullName -> { status, duration, retries }
      },

      /**
       * Record a test result in the current run
       * @param {string} testFullName - Full test name (file + test name)
       * @param {string} status - Test status (passed, failed, etc.)
       * @param {number} duration - Test duration in ms
       * @param {number} retries - Number of retries (if any)
       */
      recordTest: (testFullName, status, duration, retries = 0) => {
        this.flakyTracker.currentRun.tests.set(testFullName, {
          status,
          duration,
          retries,
          timestamp: new Date().toISOString(),
        });
      },

      /**
       * Analyze test history to identify flaky tests
       * @returns {Array} Array of flaky test objects
       */
      analyzeFlakyTests: () => {
        const flakyTests = [];

        for (const [testName, testHistory] of Object.entries(
          this.flakyTracker.history
        )) {
          if (!testHistory.runs || testHistory.runs.length < 3) {
            continue; // Need at least 3 runs to detect flakiness
          }

          const recentRuns = testHistory.runs.slice(-20); // Check last 20 runs
          const failures = recentRuns.filter(
            (run) => run.status === "failed"
          ).length;
          const total = recentRuns.length;
          const failureRate = failures / total;
          const hasPassesAndFailures =
            recentRuns.some((r) => r.status === "passed") &&
            recentRuns.some((r) => r.status === "failed");

          if (
            hasPassesAndFailures &&
            failureRate >= this.flakyTracker.flakyThreshold
          ) {
            flakyTests.push({
              testName,
              failureRate: Math.round(failureRate * 100),
              totalRuns: total,
              failures,
              passes: total - failures,
              lastFailure: recentRuns.filter((r) => r.status === "failed").pop()
                ?.timestamp,
              averageDuration: Math.round(
                recentRuns.reduce((sum, r) => sum + (r.duration || 0), 0) /
                  total
              ),
            });
          }
        }

        return flakyTests.sort((a, b) => b.failureRate - a.failureRate);
      },

      /**
       * Save current run results to history and persist to file
       */
      saveHistory: () => {
        const currentRun = this.flakyTracker.currentRun;

        // Update history with current run results
        for (const [testName, testResult] of currentRun.tests) {
          if (!this.flakyTracker.history[testName]) {
            this.flakyTracker.history[testName] = { runs: [] };
          }

          // Add current result to history
          this.flakyTracker.history[testName].runs.push({
            timestamp: testResult.timestamp,
            status: testResult.status,
            duration: testResult.duration,
            retries: testResult.retries,
          });

          // Trim history to max runs
          const runs = this.flakyTracker.history[testName].runs;
          if (runs.length > this.flakyTracker.maxHistoryRuns) {
            this.flakyTracker.history[testName].runs = runs.slice(
              -this.flakyTracker.maxHistoryRuns
            );
          }
        }

        // Save to file
        try {
          fs.writeFileSync(
            this.flakyTracker.historyFile,
            JSON.stringify(this.flakyTracker.history, null, 2)
          );
        } catch (error) {
          this.log(
            `Error saving flaky test history: ${error.message}`,
            "ERROR"
          );
        }
      },
    };
  }

  /**
   * Utility method to log messages with timestamp
   * @param {string} message - Message to log
   * @param {string} level - Log level (INFO, WARN, ERROR)
   */
  log(message, level = "INFO") {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;

    if (this.verbose) {
      console.log(logEntry);
    }

    // Append to log file
    fs.appendFileSync(this.logFile, logEntry + "\n");
  }

  /**
   * Called at the beginning of the test run
   * @param {AggregatedResult} results - Initial results object
   * @param {Object} options - Run options
   */
  onRunStart(results, options) {
    this.startTime = Date.now();
    this.log("🏁 TEST RUN STARTED", "INFO");
    this.log(
      `📦 Jest version: ${
        process.env.npm_package_devDependencies_jest || "unknown"
      }`
    );
    this.log(`🎯 Test pattern: ${options.testPathPattern || "all tests"}`);
    this.log(`🔄 Watch mode: ${options.watchman ? "ON" : "OFF"}`);
    this.log(`⚡ Max workers: ${this.globalConfig.maxWorkers}`);
    this.log(`📁 Root directory: ${this.globalConfig.rootDir}`);

    // Log project configurations for multi-project setup
    if (this.globalConfig.projects && this.globalConfig.projects.length > 0) {
      this.log(
        `🏗️  Multi-project setup detected: ${this.globalConfig.projects.length} projects`
      );
      this.globalConfig.projects.forEach((project, index) => {
        this.log(
          `   Project ${index + 1}: ${project.displayName || "unnamed"}`
        );
      });
    }
  }

  /**
   * Called when a test file starts running
   * @param {Test} test - Test file information
   */
  onTestFileStart(test) {
    const filePath = test.path;
    const environment = test.context.config.testEnvironment;

    // Extract project name more reliably
    const projectName =
      test.context.config.displayName?.name ||
      test.context.config.displayName ||
      "default";

    // Store the correct environment and project info for this test file
    this.testFileEnvironments.set(filePath, {
      environment,
      projectName,
    });

    this.log(
      `📝 Starting test file: ${path.relative(process.cwd(), test.path)}`
    );
    this.log(`   Project: ${projectName}`);
    this.log(`   Environment: ${environment}`);
  }

  /**
   * Called when an individual test case starts
   * @param {Test} test - Test file information
   * @param {TestCaseStartInfo} testCaseStartInfo - Test case details
   */
  onTestCaseStart(test, testCaseStartInfo) {
    if (this.verbose) {
      const testFileInfo = this.testFileEnvironments.get(test.path);
      const correctEnvironment = testFileInfo?.environment || "unknown";
      const correctProject = testFileInfo?.projectName || "unknown";

      this.log(`  ▶️  Test case started: ${testCaseStartInfo.title}`);
      this.log(`     Full name: ${testCaseStartInfo.fullName}`);
      this.log(
        `     Ancestral titles: ${testCaseStartInfo.ancestorTitles.join(" > ")}`
      );
      this.log(`     Project: ${correctProject}`);
      this.log(`     Environment: ${correctEnvironment}`);
    }

    // Start leak detection for this test
    if (this.leakDetector) {
      const testName = testCaseStartInfo.fullName;
      const testFile = path.relative(process.cwd(), test.path);
      this.currentLeakTestId = this.leakDetector.startTest(testName, testFile);
    }
  }

  /**
   * Called when an individual test case completes
   * @param {Test} test - Test file information
   * @param {TestCaseResult} testCaseResult - Test case result
   */
  onTestCaseResult(test, testCaseResult) {
    const status = testCaseResult.status;
    const duration = testCaseResult.duration;
    const emoji = this.getStatusEmoji(status);
    const testFullName = `${path.relative(process.cwd(), test.path)} > ${
      testCaseResult.fullName
    }`;
    const testRetryTimes = testCaseResult.invocations;

    this.log(`  ${emoji} Test case completed: ${testCaseResult.title}`);
    this.log(`     Status: ${status.toUpperCase()}`);
    this.log(`     Duration: ${duration}ms`);

    // Record test result for flaky test tracking
    const retries = testCaseResult.retryReasons
      ? testCaseResult.retryReasons.length
      : 0;
    this.flakyTracker.recordTest(testFullName, status, duration, retries);

    // Log additional details for failed tests
    if (status === "failed") {
      this.log(`     ❌ Failure details:`, "ERROR");
      testCaseResult.failureDetails?.forEach((failure, index) => {
        this.log(`        ${index + 1}. ${failure.message}`, "ERROR");
      });

      // Log failure messages
      testCaseResult.failureMessages?.forEach((message, index) => {
        this.log(
          `        Failure ${index + 1}: ${message.split("\n")[0]}`,
          "ERROR"
        );
      });
    }

    if (testRetryTimes > 1) {
      this.log(`     🔄 Retries: ${testRetryTimes}`, "WARN");
      this.log(
        `     ⚠️  Test required multiple invocations - potential flakiness detected`,
        "WARN"
      );
    }

    // Log retry information if applicable
    if (retries > 0) {
      this.log(`     🔄 Retries: ${retries}`, "WARN");
      this.log(
        `     ⚠️  Test required retries - potential flakiness detected`,
        "WARN"
      );
    }

    // Finish leak detection for this test
    if (this.leakDetector && this.currentLeakTestId) {
      const leakMetrics = this.leakDetector.finishTest(this.currentLeakTestId, status);
      
      // Log immediate leak warnings
      if (leakMetrics && (leakMetrics.leaksDetected.length > 0 || leakMetrics.warnings.length > 0)) {
        this.log(`     🚨 Memory leak detected in test!`, "WARN");
        if (leakMetrics.leaksDetected.length > 0) {
          this.log(`        ${leakMetrics.leaksDetected.length} leak(s): ${leakMetrics.leaksDetected.map(l => l.type).join(', ')}`, "WARN");
        }
      }
      
      this.currentLeakTestId = null;
    }
  }

  /**
   * Called when a test file completes
   * @param {Test} test - Test file information
   * @param {TestResult} testResult - Test file result
   * @param {AggregatedResult} aggregatedResult - Current aggregated results
   */
  onTestFileResult(test, testResult, aggregatedResult) {
    const relativePath = path.relative(process.cwd(), test.path);
    const { numPassingTests, numFailingTests, numPendingTests, numTodoTests } =
      testResult;
    const duration = testResult.perfStats.end - testResult.perfStats.start;

    this.log(`✅ Test file completed: ${relativePath}`);
    this.log(
      `   📊 Results: ${numPassingTests} passed, ${numFailingTests} failed, ${numPendingTests} pending, ${numTodoTests} todo`
    );
    this.log(`   ⏱️  Duration: ${duration}ms`);
    this.log(
      `   🎯 Coverage: ${testResult.coverage ? "collected" : "not collected"}`
    );

    // Log console output if present
    if (testResult.console && testResult.console.length > 0) {
      this.log(`   📢 Console output: ${testResult.console.length} messages`);
      if (this.verbose) {
        testResult.console.forEach((message, index) => {
          this.log(`      ${index + 1}. [${message.type}] ${message.message}`);
        });
      }
    }

    // Log snapshot information
    if (testResult.snapshot) {
      const { added, matched, unmatched, updated } = testResult.snapshot;
      if (added + matched + unmatched + updated > 0) {
        this.log(
          `   📸 Snapshots: ${matched} matched, ${added} added, ${updated} updated, ${unmatched} unmatched`
        );
      }
    }

    // Store result for final summary
    this.testResults.push({
      file: relativePath,
      duration,
      passed: numPassingTests,
      failed: numFailingTests,
      pending: numPendingTests,
      todo: numTodoTests,
    });
  }

  /**
   * Called at the end of the entire test run
   * @param {Set<Context>} contexts - Test contexts
   * @param {AggregatedResult} results - Final aggregated results
   */
  onRunComplete(contexts, results) {
    const totalDuration = Date.now() - this.startTime;
    const {
      numTotalTests,
      numPassedTests,
      numFailedTests,
      numPendingTests,
      numTodoTests,
      numTotalTestSuites,
      numPassedTestSuites,
      numFailedTestSuites,
      numPendingTestSuites,
    } = results;

    this.log("🏁 TEST RUN COMPLETED", "INFO");
    this.log("═".repeat(60));

    // Test suite summary
    this.log(`📦 Test Suites: ${numTotalTestSuites} total`);
    this.log(`   ✅ Passed: ${numPassedTestSuites}`);
    this.log(`   ❌ Failed: ${numFailedTestSuites}`);
    this.log(`   ⏸️  Pending: ${numPendingTestSuites}`);

    // Individual test summary
    this.log(`🧪 Tests: ${numTotalTests} total`);
    this.log(`   ✅ Passed: ${numPassedTests}`);
    this.log(`   ❌ Failed: ${numFailedTests}`);
    this.log(`   ⏸️  Pending: ${numPendingTests}`);
    this.log(`   📝 Todo: ${numTodoTests}`);

    // Timing information
    this.log(
      `⏱️  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(
        2
      )}s)`
    );
    this.log(
      `⚡ Average per test: ${(totalDuration / numTotalTests).toFixed(2)}ms`
    );

    // Success rate
    const successRate = ((numPassedTests / numTotalTests) * 100).toFixed(1);
    this.log(`📈 Success Rate: ${successRate}%`);

    // Slowest test files
    if (this.testResults.length > 0) {
      const slowestFiles = this.testResults
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3);

      this.log(`🐌 Slowest test files:`);
      slowestFiles.forEach((file, index) => {
        this.log(`   ${index + 1}. ${file.file}: ${file.duration}ms`);
      });
    }

    // Analyze and report flaky tests
    this.flakyTracker.saveHistory();
    const flakyTests = this.flakyTracker.analyzeFlakyTests();

    if (flakyTests.length > 0) {
      this.log(
        `🔄 FLAKY TESTS DETECTED: ${flakyTests.length} potentially unstable test(s)`,
        "WARN"
      );
      this.log("─".repeat(60));

      flakyTests.forEach((flaky, index) => {
        this.log(`${index + 1}. ${flaky.testName}`, "WARN");
        this.log(
          `   📊 Failure Rate: ${flaky.failureRate}% (${flaky.failures}/${flaky.totalRuns} runs)`,
          "WARN"
        );
        this.log(`   ⏱️  Average Duration: ${flaky.averageDuration}ms`, "WARN");
        if (flaky.lastFailure) {
          this.log(
            `   📅 Last Failure: ${new Date(
              flaky.lastFailure
            ).toLocaleString()}`,
            "WARN"
          );
        }
        this.log(
          `   💡 Recommendation: Review for timing dependencies, race conditions, or external dependencies`,
          "WARN"
        );
        this.log(""); // Empty line for readability
      });

      this.log("📋 Flaky Test Actions:");
      this.log("   • Run tests multiple times to confirm flakiness");
      this.log("   • Check for timing dependencies or async issues");
      this.log(
        "   • Review external dependencies (network, file system, etc.)"
      );
      this.log(
        "   • Consider adding proper waits or mocking external dependencies"
      );
      this.log(
        "   • Use Jest's retry configuration for truly flaky infrastructure"
      );
      this.log("─".repeat(60));
    } else {
      this.log(`✅ No flaky tests detected in recent history`, "INFO");
    }

    // Analyze and report memory leaks
    if (this.leakDetector) {
      const leakSummary = this.leakDetector.getSummary();
      
      if (leakSummary.totalLeaks > 0 || leakSummary.totalWarnings > 0) {
        this.log(`💧 MEMORY LEAKS DETECTED: ${leakSummary.testsWithLeaks} test(s) with leaks`, "WARN");
        this.log("─".repeat(60));
        
        this.log(`📊 Leak Summary:`, "WARN");
        this.log(`   🧪 Tests Analyzed: ${leakSummary.totalTests}`, "WARN");
        this.log(`   🚨 Tests with Leaks: ${leakSummary.testsWithLeaks} (${leakSummary.totalLeaks} total leaks)`, "WARN");
        this.log(`   ⚠️  Tests with Warnings: ${leakSummary.testsWithWarnings} (${leakSummary.totalWarnings} total warnings)`, "WARN");
        
        if (Object.keys(leakSummary.leakTypeBreakdown).length > 0) {
          this.log(`📈 Leak Types:`, "WARN");
          Object.entries(leakSummary.leakTypeBreakdown).forEach(([type, count]) => {
            this.log(`   ${type}: ${count}`, "WARN");
          });
        }
        
        if (leakSummary.worstOffenders.length > 0) {
          this.log(`🏆 Worst Offenders:`, "WARN");
          leakSummary.worstOffenders.slice(0, 3).forEach((offender, index) => {
            this.log(`   ${index + 1}. ${offender.test}`, "WARN");
            this.log(`      Leaks: ${offender.leakCount}, Memory: ${offender.memoryImpact}MB`, "WARN");
          });
        }
        
        this.log("📋 Leak Prevention Actions:", "WARN");
        this.log("   • Clear timers: clearTimeout(), clearInterval()");
        this.log("   • Remove event listeners: removeEventListener()");
        this.log("   • Clean up DOM nodes and component instances");
        this.log("   • Cancel pending promises and requests");
        this.log("   • Reset global variables in afterEach()");
        this.log("   • Check leak-detection.log for detailed analysis");
        this.log("─".repeat(60));
      } else {
        this.log(`✅ No memory leaks detected in recent tests`, "INFO");
      }
    }

    // Final status
    if (numFailedTests > 0) {
      this.log(`❌ TEST RUN FAILED: ${numFailedTests} test(s) failed`, "ERROR");
    } else {
      this.log(`✅ TEST RUN PASSED: All tests successful!`, "INFO");
    }

    this.log("═".repeat(60));
    this.log(`📄 Full report saved to: ${this.logFile}`);
    this.log(
      `📈 Flaky test history saved to: ${this.flakyTracker.historyFile}`
    );
    if (this.leakDetector) {
      this.log(`💧 Leak detection log saved to: ${this.leakDetector.options.logFile}`);
    }
  }

  /**
   * Get emoji for test status
   * @param {string} status - Test status
   * @returns {string} Appropriate emoji
   */
  getStatusEmoji(status) {
    switch (status) {
      case "passed":
        return "✅";
      case "failed":
        return "❌";
      case "pending":
        return "⏸️";
      case "todo":
        return "📝";
      case "skipped":
        return "⏭️";
      default:
        return "❓";
    }
  }
}

module.exports = CustomReporter;
