const { capitalize, isEven } = require('./utils')

describe('Utility functions', () => {
  test('capitalize function', () => {
    expect(capitalize('hello')).toBe('Hello')
    expect(capitalize('world')).toBe('World')
    expect(capitalize('a')).toBe('A')
  })

  test('isEven function', () => {
    expect(isEven(4)).toBe(true)
    expect(isEven(3)).toBe(false)
    expect(isEven(0)).toBe(true)
  })
})
