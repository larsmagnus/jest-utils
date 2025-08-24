import type {
  Reporter,
  Test,
  AggregatedResult,
  TestResult,
  ReporterOnStartOptions,
  TestContext,
} from '@jest/reporters'
import { Exporter } from '../tools/exporter'

type ReporterEvent =
  | { event: 'runStart'; timestamp: number; results: AggregatedResult }
  | { event: 'testStart'; timestamp: number; testFilePath: string }
  | {
      event: 'testResult'
      timestamp: number
      testFilePath: string
      status: string
      numPassingTests: number
      numFailingTests: number
      testResults?: Array<{
        title: string
        status: string
        duration: number | null | undefined
      }>
    }
  | { event: 'runComplete'; timestamp: number; results: AggregatedResult }

/**
 * Barebones reporter implementation.
 *
 * @see https://github.com/facebook/jest/blob/master/packages/jest-reporters/src/types.ts
 * @see https://jestjs.io/docs/en/configuration#reporters-arraymodulename--modulename-options
 */
export default class MyReporter implements Reporter {
  private collector: Exporter<ReporterEvent>

  constructor() {
    // Configure output path and format as needed
    this.collector = new Exporter({
      outputPath: 'reports/test-report.json',
      format: 'json',
      // Optionally, select/transform data before output
      // select: data => data,
    })
  }

  onRunStart(
    results: AggregatedResult,
    options: ReporterOnStartOptions
  ): void | Promise<void> {
    // Example: collect run start info
    this.collector.add({ event: 'runStart', timestamp: Date.now(), results })
  }

  onTestStart(test: Test): void | Promise<void> {
    // Example: collect test start info
    this.collector.add({
      event: 'testStart',
      timestamp: Date.now(),
      testFilePath: test.path,
    })
  }

  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult
  ): void | Promise<void> {
    // Collect test result info
    this.collector.add({
      event: 'testResult',
      timestamp: Date.now(),
      testFilePath: test.path,
      status: testResult.numFailingTests > 0 ? 'failed' : 'passed',
      numPassingTests: testResult.numPassingTests,
      numFailingTests: testResult.numFailingTests,
      testResults: testResult.testResults?.map((tr) => ({
        title: tr.title,
        status: tr.status,
        duration: tr.duration,
      })),
    })
  }

  async onRunComplete(
    contexts: Set<TestContext>,
    results: AggregatedResult
  ): Promise<void> {
    // Collect run complete info
    this.collector.add({ event: 'runComplete', timestamp: Date.now(), results })
    // Write the report file
    await this.collector.writeReport()
  }

  getLastError(): void | Error {
    console.log('last error!', 'error')
  }
}
