import { filterArray, sortNumbers, groupBy, unique, chunk } from './data'

describe('Data processing functions (TypeScript)', () => {
  describe('filterArray function', () => {
    test('should filter numbers correctly', () => {
      const numbers = [1, 2, 3, 4, 5, 6]
      const evens = filterArray(numbers, (n) => n % 2 === 0)
      expect(evens).toEqual([2, 4, 6])
    })

    test('should filter strings correctly', () => {
      const words = ['apple', 'banana', 'cherry', 'date']
      const longWords = filterArray(words, (word) => word.length > 5)
      expect(longWords).toEqual(['banana', 'cherry'])
    })

    test('should handle empty arrays', () => {
      const empty: number[] = []
      const result = filterArray(empty, (n) => n > 0)
      expect(result).toEqual([])
    })

    test('should work with complex objects', () => {
      interface Person {
        name: string
        age: number
      }

      const people: Person[] = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 17 },
        { name: 'Charlie', age: 30 },
      ]

      const adults = filterArray(people, (person) => person.age >= 18)
      expect(adults).toEqual([
        { name: 'Alice', age: 25 },
        { name: 'Charlie', age: 30 },
      ])
    })
  })

  describe('sortNumbers function', () => {
    test('should sort numbers in ascending order', () => {
      const unsorted = [3, 1, 4, 1, 5, 9, 2, 6]
      const sorted = sortNumbers(unsorted)
      expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
    })

    test('should not modify original array', () => {
      const original = [3, 1, 4, 1, 5, 9, 2, 6]
      const originalCopy = [...original]
      sortNumbers(original)
      expect(original).toEqual(originalCopy)
    })

    test('should handle negative numbers', () => {
      const numbers = [-3, 1, -1, 0, 5]
      const sorted = sortNumbers(numbers)
      expect(sorted).toEqual([-3, -1, 0, 1, 5])
    })

    test('should handle empty array', () => {
      const empty: number[] = []
      const sorted = sortNumbers(empty)
      expect(sorted).toEqual([])
    })
  })

  describe('groupBy function', () => {
    test('should group numbers by parity', () => {
      const numbers = [1, 2, 3, 4, 5, 6]
      const grouped = groupBy(numbers, (n) => (n % 2 === 0 ? 'even' : 'odd'))
      expect(grouped).toEqual({
        odd: [1, 3, 5],
        even: [2, 4, 6],
      })
    })

    test('should group objects by property', () => {
      interface Product {
        name: string
        category: string
        price: number
      }

      const products: Product[] = [
        { name: 'Apple', category: 'fruit', price: 1 },
        { name: 'Carrot', category: 'vegetable', price: 2 },
        { name: 'Banana', category: 'fruit', price: 1.5 },
      ]

      const byCategory = groupBy(products, (p) => p.category)
      expect(byCategory).toEqual({
        fruit: [
          { name: 'Apple', category: 'fruit', price: 1 },
          { name: 'Banana', category: 'fruit', price: 1.5 },
        ],
        vegetable: [{ name: 'Carrot', category: 'vegetable', price: 2 }],
      })
    })
  })

  describe('unique function', () => {
    test('should remove duplicate numbers', () => {
      const numbers = [1, 2, 2, 3, 3, 3, 4]
      const uniqueNumbers = unique(numbers)
      expect(uniqueNumbers).toEqual([1, 2, 3, 4])
    })

    test('should remove duplicate strings', () => {
      const words = ['apple', 'banana', 'apple', 'cherry', 'banana']
      const uniqueWords = unique(words)
      expect(uniqueWords).toEqual(['apple', 'banana', 'cherry'])
    })

    test('should handle empty array', () => {
      const empty: string[] = []
      const result = unique(empty)
      expect(result).toEqual([])
    })
  })

  describe('chunk function', () => {
    test('should split array into chunks of specified size', () => {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8]
      const chunks = chunk(numbers, 3)
      expect(chunks).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ])
    })

    test('should handle exact divisions', () => {
      const numbers = [1, 2, 3, 4, 5, 6]
      const chunks = chunk(numbers, 2)
      expect(chunks).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ])
    })

    test('should handle chunk size larger than array', () => {
      const numbers = [1, 2, 3]
      const chunks = chunk(numbers, 5)
      expect(chunks).toEqual([[1, 2, 3]])
    })

    test('should throw error for invalid chunk size', () => {
      const numbers = [1, 2, 3]
      expect(() => chunk(numbers, 0)).toThrow(
        'Chunk size must be greater than 0'
      )
      expect(() => chunk(numbers, -1)).toThrow(
        'Chunk size must be greater than 0'
      )
    })

    test('should handle empty array', () => {
      const empty: number[] = []
      const chunks = chunk(empty, 2)
      expect(chunks).toEqual([])
    })
  })
})
