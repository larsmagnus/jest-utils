const { add } = require('./math')

describe('Simple leak test', () => {
  test('global variable leak', () => {
    // Create a large global variable
    global.bigLeakyData = Array.from({ length: 100000 }).fill('leak data')
    global.leakyCounter = (global.leakyCounter || 0) + 1

    expect(add(2, 3)).toBe(5)

    // Intentionally don't clean up (this should be detected as a leak)
  })

  test('clean test', () => {
    // This test cleans up properly
    const _localData = Array.from({ length: 1000 }).fill('clean data')

    expect(add(1, 1)).toBe(2)

    // localData will be automatically garbage collected
  })
})
