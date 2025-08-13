import { UserService, User, delay, retryOperation, Cache } from './async-utils'

// Mock fetch globally
global.fetch = jest.fn()

describe('Async Utilities (TypeScript)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('UserService', () => {
    let userService: UserService
    const mockUser: User = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      isActive: true,
    }

    beforeEach(() => {
      userService = new UserService('https://test-api.com')
    })

    describe('fetchUser', () => {
      test('should fetch user successfully', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(mockUser),
        } as any

        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        const result = await userService.fetchUser(1)

        expect(global.fetch).toHaveBeenCalledWith(
          'https://test-api.com/users/1'
        )
        expect(result).toEqual(mockUser)
      })

      test('should throw error on failed request', async () => {
        const mockResponse = {
          ok: false,
          statusText: 'Not Found',
        } as any

        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        await expect(userService.fetchUser(999)).rejects.toThrow(
          'Failed to fetch user: Not Found'
        )
      })
    })

    describe('createUser', () => {
      test('should create user successfully', async () => {
        const newUserData: Omit<User, 'id'> = {
          name: 'Jane Doe',
          email: 'jane@example.com',
          isActive: true,
        }

        const createdUser: User = { id: 2, ...newUserData }

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(createdUser),
        } as any

        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        const result = await userService.createUser(newUserData)

        expect(global.fetch).toHaveBeenCalledWith(
          'https://test-api.com/users',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newUserData),
          }
        )
        expect(result).toEqual(createdUser)
      })
    })

    describe('updateUser', () => {
      test('should update user successfully', async () => {
        const updates: Partial<Omit<User, 'id'>> = {
          name: 'John Updated',
          isActive: false,
        }

        const updatedUser: User = { ...mockUser, ...updates }

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(updatedUser),
        } as any

        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        const result = await userService.updateUser(1, updates)

        expect(global.fetch).toHaveBeenCalledWith(
          'https://test-api.com/users/1',
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          }
        )
        expect(result).toEqual(updatedUser)
      })
    })

    describe('deleteUser', () => {
      test('should delete user successfully', async () => {
        const mockResponse = { ok: true } as any
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        const result = await userService.deleteUser(1)

        expect(global.fetch).toHaveBeenCalledWith(
          'https://test-api.com/users/1',
          {
            method: 'DELETE',
          }
        )
        expect(result).toBe(true)
      })

      test('should return false on failed deletion', async () => {
        const mockResponse = { ok: false } as any
        ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

        const result = await userService.deleteUser(1)
        expect(result).toBe(false)
      })
    })
  })

  describe('delay function', () => {
    test('should delay execution for specified time', async () => {
      const start = Date.now()
      await delay(100)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(95) // Allow for small timing variations
      expect(elapsed).toBeLessThan(150)
    })
  })

  describe('retryOperation', () => {
    test('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await retryOperation(operation, 3, 10)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    test('should retry on failure and eventually succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success')

      const result = await retryOperation(operation, 3, 10)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    test('should fail after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'))

      await expect(retryOperation(operation, 3, 10)).rejects.toThrow(
        'Operation failed after 3 attempts: Always fails'
      )

      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('Cache', () => {
    let cache: Cache<string>

    beforeEach(() => {
      cache = new Cache<string>(1000) // 1 second TTL
    })

    test('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
      expect(cache.has('key1')).toBe(true)
    })

    test('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
      expect(cache.has('nonexistent')).toBe(false)
    })

    test('should expire values after TTL', async () => {
      cache.set('key1', 'value1', 50) // 50ms TTL
      expect(cache.get('key1')).toBe('value1')

      await delay(60)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.has('key1')).toBe(false)
    })

    test('should delete specific keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBe('value2')
      expect(cache.delete('nonexistent')).toBe(false)
    })

    test('should clear all values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.clear()

      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
      expect(cache.size()).toBe(0)
    })

    test('should return correct size', () => {
      expect(cache.size()).toBe(0)

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)

      cache.delete('key1')
      expect(cache.size()).toBe(1)
    })

    test('should work with different types', () => {
      const numberCache = new Cache<number>()
      const objectCache = new Cache<{ name: string; age: number }>()

      numberCache.set('count', 42)
      expect(numberCache.get('count')).toBe(42)

      const user = { name: 'Alice', age: 30 }
      objectCache.set('user1', user)
      expect(objectCache.get('user1')).toEqual(user)
    })
  })
})
