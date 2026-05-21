import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock the logger so tests don't write to the real consola / loglevel
// surfaces and accidentally trip on side effects in the production
// logger module. The mock has to mirror every context the production
// code actually calls — `logger.api`, `logger.ui`, etc. — or the test
// blows up with "Cannot read properties of undefined (reading 'debug')"
// the moment any non-api logger call runs (e.g. the
// `desktopNotifications` service logs via `logger.ui.debug`).
const makeLoggerContext = () => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
})

vi.mock('../utils/logger', () => ({
  logger: {
    auth: makeLoggerContext(),
    api: makeLoggerContext(),
    ui: makeLoggerContext(),
    network: makeLoggerContext(),
    database: makeLoggerContext(),
    user: makeLoggerContext(),
    system: makeLoggerContext(),
  },
}))
