import log from 'loglevel';
import consola from 'consola';
import {
  logStore,
  redactString,
  redactValue,
  type LogLevelName,
  type LogContextName,
} from '../services/logStore';

// Log levels
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5,
}

// Log contexts
export enum LogContext {
  AUTH = 'auth',
  API = 'api',
  UI = 'ui',
  NETWORK = 'network',
  DATABASE = 'database',
  USER = 'user',
  SYSTEM = 'system',
}

// Format log message with timestamp, level, and context. Redaction of the
// message string is handled by the caller (see PufferblowLogger.log) so we
// don't double-redact.
function formatLogMessage(level: string, context: LogContext, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context.toUpperCase()}] ${message}`;
}

// Custom logger class
class PufferblowLogger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    // Redact BOTH message and args before they leave this function so that
    // every downstream surface — devtools console (consola/loglevel), the
    // in-app Logs viewer, and the on-disk daily log file — sees the same
    // redacted payload. Anything that walks past this point with the raw
    // value is a token leak waiting to happen.
    const safeMessage = redactString(message);
    const safeArgs: any[] = args.map((arg) => redactValue(arg));
    const formattedMessage = formatLogMessage(LogLevel[level], this.context, safeMessage);

    // Use consola for better formatting in development
    switch (level) {
      case LogLevel.TRACE:
        consola.trace(formattedMessage, ...safeArgs);
        break;
      case LogLevel.DEBUG:
        consola.debug(formattedMessage, ...safeArgs);
        break;
      case LogLevel.INFO:
        consola.info(formattedMessage, ...safeArgs);
        break;
      case LogLevel.WARN:
        consola.warn(formattedMessage, ...safeArgs);
        break;
      case LogLevel.ERROR:
        consola.error(formattedMessage, ...safeArgs);
        break;
    }

    // Also use loglevel for programmatic level control
    const loglevelMethod = LogLevel[level].toLowerCase() as keyof typeof log;
    if (typeof log[loglevelMethod] === 'function') {
      // Use apply to avoid TypeScript spread issues
      log[loglevelMethod].apply(log, [formattedMessage, ...safeArgs]);
    }

    // Persist to the in-app log buffer so the title-bar Logs viewer can show it.
    // Pass the redacted message; logStore.push will re-run redactString on it
    // (idempotent) and will also walk args through redactValue defensively.
    logStore.push(
      LogLevel[level].toLowerCase() as LogLevelName,
      this.context as unknown as LogContextName,
      safeMessage,
      safeArgs,
    );
  }

  trace(message: string, ...args: any[]): void {
    this.log(LogLevel.TRACE, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

// Create logger instances for different contexts
export const logger = {
  auth: new PufferblowLogger(LogContext.AUTH),
  api: new PufferblowLogger(LogContext.API),
  ui: new PufferblowLogger(LogContext.UI),
  network: new PufferblowLogger(LogContext.NETWORK),
  database: new PufferblowLogger(LogContext.DATABASE),
  user: new PufferblowLogger(LogContext.USER),
  system: new PufferblowLogger(LogContext.SYSTEM),
};

// Configure loglevel based on environment
if (typeof window !== 'undefined') {
  // Browser environment
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      log.setLevel('warn');
      consola.level = 2; // warn level
      break;
    case 'development':
    default:
      log.setLevel('debug');
      consola.level = 4; // debug level
      break;
  }
}

// Convenience helper for instrumenting user-driven actions (clicks, sends,
// navigation). Routes through logger.user so it lands in the in-app log buffer
// alongside every other contextual log.
export const logUserAction = (action: string, details?: Record<string, unknown>): void => {
  if (details) {
    logger.user.info(`action:${action}`, details);
  } else {
    logger.user.info(`action:${action}`);
  }
};

// Export types and utilities. `redactSensitiveData` is kept as a backwards-
// compatible alias for the new centralized `redactString` from logStore.
export type { PufferblowLogger };
export { redactString as redactSensitiveData, redactString, redactValue };
