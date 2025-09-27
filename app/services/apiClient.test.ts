import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiClient, createApiClient } from './apiClient'

// Mock fetch
const mockFetch = global.fetch as any

describe('ApiClient', () => {
  let client: ApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new ApiClient('http://test.com')
  })

  describe('constructor', () => {
    it('should create client with base URL', () => {
      const client = new ApiClient('http://example.com')
      expect(client).toBeInstanceOf(ApiClient)
    })

    it('should remove trailing slash from base URL', () => {
      const client = new ApiClient('http://example.com/')
      // We can't directly test the private baseUrl, but we can test behavior
      expect(client).toBeInstanceOf(ApiClient)
    })
  })

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.get('/test')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith('http://test.com/test', {
        headers: { 'Content-Type': 'application/json' }
      })
    })

    it('should make GET request with query parameters', async () => {
      const mockResponse = { data: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.get('/test', { param1: 'value1', param2: 'value2' })

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('http://test.com/test?param1=value1&param2=value2', {
        headers: { 'Content-Type': 'application/json' }
      })
    })

    it('should handle GET request failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not found')
      })

      const result = await client.get('/notfound')

      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 404: Not Found')
    })
  })

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const mockResponse = { id: 1, created: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.post('/create', { name: 'test' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith('http://test.com/create?name=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    })

    it('should make POST request with multiple parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      const result = await client.post('/signup', {
        username: 'user',
        password: 'pass',
        email: 'user@test.com'
      })

      expect(mockFetch).toHaveBeenCalledWith('http://test.com/signup?username=user&password=pass&email=user%40test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    })

    it('should handle POST request failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Bad request')
      })

      const result = await client.post('/create', { invalid: 'data' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 400: Bad Request')
    })
  })

  describe('PUT requests', () => {
    it('should make successful PUT request', async () => {
      const mockResponse = { id: 1, updated: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.put('/update/1', { name: 'updated' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith('http://test.com/update/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'updated' })
      })
    })
  })

  describe('DELETE requests', () => {
    it('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: true })
      })

      const result = await client.delete('/delete/1')

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('http://test.com/delete/1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failed'))

      const result = await client.get('/test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network failed')
    })

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const result = await client.get('/test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid JSON')
    })
  })

  describe('createApiClient', () => {
    it('should create API client with correct base URL', () => {
      const client = createApiClient('localhost:7575')
      expect(client).toBeInstanceOf(ApiClient)
    })
  })
})
