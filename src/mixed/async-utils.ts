export interface User {
  id: number
  name: string
  email: string
  isActive: boolean
}

export interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

export class UserService {
  private baseUrl: string

  constructor(baseUrl: string = 'https://api.example.com') {
    this.baseUrl = baseUrl
  }

  async fetchUser(id: number): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`)
    }
    return response.json()
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`)
    }

    return response.json()
  }

  async updateUser(
    id: number,
    updates: Partial<Omit<User, 'id'>>
  ): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error(`Failed to update user: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteUser(id: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/users/${id}`, {
      method: 'DELETE',
    })

    return response.ok
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) {
        throw new Error(
          `Operation failed after ${maxRetries} attempts: ${lastError.message}`
        )
      }

      await delay(delayMs * attempt)
    }
  }

  throw lastError!
}

export class Cache<T> {
  private storage = new Map<string, { value: T; expiry: number }>()
  private defaultTtl: number

  constructor(defaultTtlMs: number = 300000) {
    // 5 minutes default
    this.defaultTtl = defaultTtlMs
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs ?? this.defaultTtl)
    this.storage.set(key, { value, expiry })
  }

  get(key: string): T | undefined {
    const item = this.storage.get(key)
    if (!item) {
      return undefined
    }

    if (Date.now() > item.expiry) {
      this.storage.delete(key)
      return undefined
    }

    return item.value
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): boolean {
    return this.storage.delete(key)
  }

  clear(): void {
    this.storage.clear()
  }

  size(): number {
    // Clean expired items first
    const now = Date.now()
    this.storage.forEach((item, key) => {
      if (now > item.expiry) {
        this.storage.delete(key)
      }
    })
    return this.storage.size
  }
}
