import { add } from './math'

jest.retryTimes(3)

describe('Flaky test simulation', () => {
  test('sometimes failing test', () => {
    // Simulate flaky behavior - fails ~30% of the time
    const shouldFail = Math.random() < 0.3

    if (shouldFail) {
      throw new Error('Random failure to simulate flaky test')
    }

    expect(add(2, 3)).toBe(5)
  })

  test('stable test', () => {
    expect(add(1, 1)).toBe(2)
  })
})
