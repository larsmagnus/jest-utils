import type {
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
const myReporter = {
  onRunStart(
    results: AggregatedResult,
    options: ReporterOnStartOptions
  ): void | Promise<void> {
    console.log('onRunStart!', results, options)
  },
  onTestStart(test: Test): void | Promise<void> {
    console.log('onTestStart!', test)
  },
  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult
  ): void | Promise<void> {
    console.log('onTestResult!', test, testResult, aggregatedResult)
  },
  onRunComplete(
    contexts: Set<TestContext>,
    results: AggregatedResult
  ): void | Promise<void> {
    console.log('onRunComplete!', contexts, results)
  },
  /**
   * Optionally, reporters can force Jest to exit with non zero code by returning
   * an `Error` from `getLastError()` method.
   *
   * @example usage
   *
   * ```ts
   * if (this._shouldFail) {
   *    return new Error('Custom error reported!');
   * }
   * ```
   */
  getLastError(): void | Error {
    console.log('last error!', 'error')
  },
}

export default myReporter
