import { add, multiply, divide, power, factorial } from './math'

describe('Math utilities (TypeScript)', () => {
  describe('add function', () => {
    test('should add positive numbers correctly', () => {
      expect(add(2, 3)).toBe(5)
      expect(add(10, 20)).toBe(30)
    })

    test('should handle negative numbers', () => {
      expect(add(-1, 1)).toBe(0)
      expect(add(-5, -3)).toBe(-8)
    })

    test('should handle decimal numbers', () => {
      expect(add(1.5, 2.5)).toBe(4)
      expect(add(0.1, 0.2)).toBeCloseTo(0.3)
    })
  })

  describe('multiply function', () => {
    test('should multiply positive numbers correctly', () => {
      expect(multiply(3, 4)).toBe(12)
      expect(multiply(7, 8)).toBe(56)
    })

    test('should handle zero multiplication', () => {
      expect(multiply(0, 5)).toBe(0)
      expect(multiply(10, 0)).toBe(0)
    })

    test('should handle negative numbers', () => {
      expect(multiply(-2, 3)).toBe(-6)
      expect(multiply(-4, -5)).toBe(20)
    })
  })

  describe('divide function', () => {
    test('should divide numbers correctly', () => {
      expect(divide(10, 2)).toBe(5)
      expect(divide(15, 3)).toBe(5)
    })

    test('should handle decimal results', () => {
      expect(divide(7, 2)).toBe(3.5)
      expect(divide(1, 3)).toBeCloseTo(0.333, 3)
    })

    test('should throw error for division by zero', () => {
      expect(() => divide(5, 0)).toThrow('Division by zero is not allowed')
      expect(() => divide(-10, 0)).toThrow('Division by zero is not allowed')
    })
  })

  describe('power function', () => {
    test('should calculate powers correctly', () => {
      expect(power(2, 3)).toBe(8)
      expect(power(5, 2)).toBe(25)
      expect(power(10, 0)).toBe(1)
    })

    test('should handle negative exponents', () => {
      expect(power(2, -2)).toBe(0.25)
      expect(power(4, -1)).toBe(0.25)
    })
  })

  describe('factorial function', () => {
    test('should calculate factorials correctly', () => {
      expect(factorial(0)).toBe(1)
      expect(factorial(1)).toBe(1)
      expect(factorial(5)).toBe(120)
      expect(factorial(4)).toBe(24)
    })

    test('should throw error for negative numbers', () => {
      expect(() => factorial(-1)).toThrow(
        'Factorial is not defined for negative numbers'
      )
      expect(() => factorial(-5)).toThrow(
        'Factorial is not defined for negative numbers'
      )
    })
  })
})
