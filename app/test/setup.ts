import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    api: {
      debug: vi.fn(),
      error: vi.fn(),
    },
  },
}))
