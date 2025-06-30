// Custom error classes for the telnet MCP server

/**
 * Base error class for MCP-Telnet errors
 */
export class MCPTelnetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPTelnetError';
  }
}

/**
 * Error thrown when a connection fails
 */
export class ConnectionError extends MCPTelnetError {
  constructor(
    message: string, 
    public readonly host?: string, 
    public readonly port?: number
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when a connection times out
 */
export class TimeoutError extends MCPTelnetError {
  constructor(
    message: string, 
    public readonly command?: string
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when trying to perform an operation requiring an active connection
 */
export class NotConnectedError extends MCPTelnetError {
  constructor(message: string = 'Not connected to a telnet server') {
    super(message);
    this.name = 'NotConnectedError';
  }
}

/**
 * Error thrown when LLM identity is required but not set
 */
export class IdentityError extends MCPTelnetError {
  constructor(message: string = 'LLM identity not set') {
    super(message);
    this.name = 'IdentityError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends MCPTelnetError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Format an error object into a string message
 * 
 * This helper makes error handling more consistent across the codebase,
 * and handles both Error objects and other thrown values.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}

/**
 * Sanitize user input for telnet commands
 * Removes potentially dangerous control characters but preserves command content
 */
export function sanitizeCommand(command: string): string {
  // Remove dangerous control characters except carriage return and line feed
  // Keep printable ASCII and common unicode characters
  // Allow tabs (0x09) as they're commonly used in commands
  return command.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validate that a string is safe for logging and display
 */
export function sanitizeForLogging(text: string): string {
  // Replace control characters with visible representations
  return text.replace(/[\x00-\x1F\x7F]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code === 9) return '\\t';    // Tab
    if (code === 10) return '\\n';   // Line feed
    if (code === 13) return '\\r';   // Carriage return
    return `\\x${code.toString(16).padStart(2, '0')}`;
  });
}
