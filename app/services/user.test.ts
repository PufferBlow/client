import { describe, it, expect, beforeEach, vi } from 'vitest'
import { login, signup, getUserProfile, extractUserIdFromToken } from './user'
import type { AuthToken, UserProfile } from './user'

// Mock fetch
const mockFetch = global.fetch as any

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        auth_token: 'test-token',
        auth_token_expire_time: '2024-12-31T23:59:59Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await login('localhost:7575', {
        username: 'testuser',
        password: 'testpass'
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7575/api/v1/users/signin?username=testuser&password=testpass',
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    })

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid credentials')
      })

      const result = await login('localhost:7575', {
        username: 'wrong',
        password: 'wrong'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 401: Unauthorized')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await login('localhost:7575', {
        username: 'test',
        password: 'test'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('signup', () => {
    it('should successfully signup with valid credentials', async () => {
      const mockResponse = {
        auth_token: 'signup-token',
        auth_token_expire_time: '2024-12-31T23:59:59Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await signup('localhost:7575', {
        username: 'newuser',
        password: 'newpass'
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7575/api/v1/users/signup?username=newuser&password=newpass',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      )
    })

    it('should handle signup failure due to existing user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        text: () => Promise.resolve('User already exists')
      })

      const result = await signup('localhost:7575', {
        username: 'existing',
        password: 'pass'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 409: Conflict')
    })
  })

  describe('getUserProfile', () => {
    it('should successfully get user profile', async () => {
      const mockProfile: UserProfile = {
        id: 'user123',
        username: 'testuser',
        discriminator: '1234',
        avatar: undefined,
        status: 'online',
        bio: 'Test bio',
        joinedAt: '2023-01-01T00:00:00Z',
        roles: ['Member']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      })

      const result = await getUserProfile('localhost:7575', 'user123', 'auth-token')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockProfile)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7575/api/v1/users/profile?user_id=user123&auth_token=auth-token',
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    })

    it('should handle profile fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('User not found')
      })

      const result = await getUserProfile('localhost:7575', 'nonexistent', 'token')

      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 404: Not Found')
    })
  })

  describe('extractUserIdFromToken', () => {
    it('should extract user ID from token', () => {
      const token = 'user123.abcdef.ghijkl'
      const userId = extractUserIdFromToken(token)

      expect(userId).toBe('user123')
    })

    it('should handle tokens without dots', () => {
      const token = 'usertoken'
      const userId = extractUserIdFromToken(token)

      expect(userId).toBe('usertoken')
    })

    it('should handle empty tokens', () => {
      const userId = extractUserIdFromToken('')

      expect(userId).toBe('')
    })
  })
})
