import type {
  Reporter,
  Test,
  AggregatedResult,
  TestResult,
  ReporterOnStartOptions,
  TestContext,
} from '@jest/reporters'

/**
 * @see https://github.com/facebook/jest/blob/master/packages/jest-reporters/src/types.ts
 * @see https://jestjs.io/docs/en/configuration#reporters-arraymodulename--modulename-options
 */
export default class MyReporter implements Reporter {
  onRunStart(
    results: AggregatedResult,
    options: ReporterOnStartOptions
  ): void | Promise<void> {
    console.log('onRunStart!')
  }
  onTestStart(test: Test): void | Promise<void> {
    console.log('onTestStart!')
  }
  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult
  ): void | Promise<void> {
    console.log('onTestResult!')
  }
  onRunComplete(
    contexts: Set<TestContext>,
    results: AggregatedResult
  ): void | Promise<void> {
    console.log('onRunComplete!')
  }
  getLastError(): void | Error {
    console.log('last error!', 'error')
  }
}
