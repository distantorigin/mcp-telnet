/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Current logging level - can be changed at runtime
// Default to INFO in production, DEBUG in development
let currentLogLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;

/**
 * Set the current logging level
 * @param level New log level to use
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log(`Log level set to ${LogLevel[level]}`, 'info');
}

/**
 * Get the current logging level
 * @returns The current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Logging utility for the MCP-Telnet server
 * Logs to stderr to avoid interfering with MCP protocol on stdout
 * @param message The message to log
 * @param level Optional log level (debug, info, warn, error)
 */
export function log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
  // Determine numeric level
  let numericLevel: LogLevel;
  switch (level) {
    case 'debug':
      numericLevel = LogLevel.DEBUG;
      break;
    case 'info':
      numericLevel = LogLevel.INFO;
      break;
    case 'warn':
      numericLevel = LogLevel.WARN;
      break;
    case 'error':
      numericLevel = LogLevel.ERROR;
      break;
    default:
      numericLevel = LogLevel.INFO;
      break;
  }
  
  // Skip logging if below current level
  if (numericLevel < currentLogLevel) {
    return;
  }

  const timestamp = new Date().toISOString();
  let prefix: string;
  
  switch (level) {
    case 'debug':
      prefix = '\x1b[90m[DEBUG]\x1b[0m'; // Gray
      break;
    case 'warn':
      prefix = '\x1b[33m[WARN]\x1b[0m';  // Yellow
      break;
    case 'error':
      prefix = '\x1b[31m[ERROR]\x1b[0m'; // Red
      break;
    default:
      prefix = '\x1b[36m[INFO]\x1b[0m';  // Cyan
      break;
  }
  
  console.error(`${prefix} [${timestamp}] ${message}`);
}
