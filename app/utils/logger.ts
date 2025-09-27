import log from 'loglevel';
import consola from 'consola';

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  /password["\s]*:[\s"']*[^"'\s]+/gi,
  /auth-token["\s]*:[\s"']*[^"'\s]+/gi,
  /authorization["\s]*:[\s"']*[^"'\s]+/gi,
  /bearer[\s]+[^"'\s]+/gi,
  /token["\s]*:[\s"']*[^"'\s]+/gi,
  /secret["\s]*:[\s"']*[^"'\s]+/gi,
  /key["\s]*:[\s"']*[^"'\s]+/gi,
  /api[_-]?key["\s]*:[\s"']*[^"'\s]+/gi,
];

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

// Redact sensitive data from messages
function redactSensitiveData(message: string): string {
  let redactedMessage = message;

  SENSITIVE_PATTERNS.forEach(pattern => {
    redactedMessage = redactedMessage.replace(pattern, (match) => {
      const key = match.split(/["\s]*:[\s"']*/)[0];
      return `${key}: [REDACTED]`;
    });
  });

  return redactedMessage;
}

// Format log message with timestamp, level, and context
function formatLogMessage(level: string, context: LogContext, message: string, args: any[] = []): string {
  const timestamp = new Date().toISOString();
  const formattedMessage = redactSensitiveData(message);

  return `[${timestamp}] [${level.toUpperCase()}] [${context.toUpperCase()}] ${formattedMessage}`;
}

// Custom logger class
class PufferblowLogger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    const formattedMessage = formatLogMessage(LogLevel[level], this.context, message, args);

    // Use consola for better formatting in development
    switch (level) {
      case LogLevel.TRACE:
        consola.trace(formattedMessage, ...args);
        break;
      case LogLevel.DEBUG:
        consola.debug(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        consola.info(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        consola.warn(formattedMessage, ...args);
        break;
      case LogLevel.ERROR:
        consola.error(formattedMessage, ...args);
        break;
    }

    // Also use loglevel for programmatic level control
    const loglevelMethod = LogLevel[level].toLowerCase() as keyof typeof log;
    if (typeof log[loglevelMethod] === 'function') {
      // Use apply to avoid TypeScript spread issues
      log[loglevelMethod].apply(log, [formattedMessage, ...args]);
    }
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

// Export types and utilities
export type { PufferblowLogger };
export { redactSensitiveData };
