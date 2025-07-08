const { add, multiply } = require('./math')

describe('Math utilities', () => {
  test('add function', () => {
    expect(add(2, 3)).toBe(5)
    expect(add(-1, 1)).toBe(0)
  })

  test('multiply function', () => {
    expect(multiply(3, 4)).toBe(12)
    expect(multiply(0, 5)).toBe(0)
  })
})
