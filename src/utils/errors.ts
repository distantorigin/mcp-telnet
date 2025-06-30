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
 * Base error class for TLS/SSL related errors
 */
export class TLSError extends ConnectionError {
  constructor(
    message: string,
    host?: string,
    port?: number,
    public readonly tlsDetails?: Record<string, any>
  ) {
    super(message, host, port);
    this.name = 'TLSError';
  }

  override toString(): string {
    let errorMessage = `${this.name}: ${this.message}`;
    if (this.host && this.port) {
      errorMessage += ` (${this.host}:${this.port})`;
    }
    if (this.tlsDetails) {
      const details = Object.entries(this.tlsDetails)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      errorMessage += ` [${details}]`;
    }
    return errorMessage;
  }
}

/**
 * Error thrown when SSL certificate validation fails
 */
export class CertificateError extends TLSError {
  constructor(
    message: string,
    host?: string,
    port?: number,
    public readonly certificateDetails?: Record<string, any>
  ) {
    super(message, host, port, certificateDetails);
    this.name = 'CertificateError';
  }

  static createFromAuthError(authError: string, host?: string, port?: number): CertificateError {
    let userMessage = 'SSL certificate validation failed';
    let suggestion = '';

    // Provide helpful error messages based on common certificate errors
    if (authError.includes('self signed certificate')) {
      userMessage = 'Server uses a self-signed certificate';
      suggestion = 'Use rejectUnauthorized: false to accept self-signed certificates (not recommended for production)';
    } else if (authError.includes('unable to verify the first certificate')) {
      userMessage = 'Unable to verify certificate chain';
      suggestion = 'The server certificate may be missing intermediate certificates';
    } else if (authError.includes('hostname/IP does not match')) {
      userMessage = 'Certificate hostname does not match the server';
      suggestion = 'Use the correct hostname or provide a custom servername parameter';
    } else if (authError.includes('certificate has expired')) {
      userMessage = 'Server certificate has expired';
      suggestion = 'Contact the server administrator to renew the certificate';
    }

    const fullMessage = suggestion 
      ? `${userMessage}. ${suggestion}. Original error: ${authError}`
      : `${userMessage}: ${authError}`;

    return new CertificateError(fullMessage, host, port, { authError, suggestion });
  }
}

/**
 * Error thrown when SSL handshake fails
 */
export class HandshakeError extends TLSError {
  constructor(
    message: string,
    host?: string,
    port?: number,
    handshakeDetails?: Record<string, any>
  ) {
    super(message, host, port, handshakeDetails);
    this.name = 'HandshakeError';
  }

  static createFromHandshakeError(error: Error, host?: string, port?: number): HandshakeError {
    let userMessage = 'SSL handshake failed';
    let debugging = '';

    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout')) {
      userMessage = 'SSL handshake timed out';
      debugging = 'Check network connectivity and server responsiveness';
    } else if (errorMessage.includes('protocol')) {
      userMessage = 'SSL protocol mismatch';
      debugging = 'Server may not support the same SSL/TLS versions';
    } else if (errorMessage.includes('cipher')) {
      userMessage = 'No compatible cipher suites found';
      debugging = 'Server and client have no common encryption algorithms';
    } else if (errorMessage.includes('closed')) {
      userMessage = 'Connection closed during handshake';
      debugging = 'Server may have rejected the connection or crashed';
    }

    const fullMessage = debugging
      ? `${userMessage}. ${debugging}. Original error: ${error.message}`
      : `${userMessage}: ${error.message}`;

    return new HandshakeError(fullMessage, host, port, { 
      originalError: error.message, 
      debugging 
    });
  }
}

/**
 * Format SSL/TLS specific errors with helpful context
 */
export function formatSSLError(error: unknown, host?: string, port?: number): string {
  if (error instanceof TLSError) {
    return error.toString();
  }
  
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Convert common Node.js TLS errors to more user-friendly messages
    if (errorMessage.includes('cert') || errorMessage.includes('certificate')) {
      return CertificateError.createFromAuthError(error.message, host, port).message;
    }
    
    if (errorMessage.includes('handshake') || errorMessage.includes('ssl') || errorMessage.includes('tls')) {
      return HandshakeError.createFromHandshakeError(error, host, port).message;
    }
    
    // For other SSL-related errors, wrap in TLS error with context
    return new TLSError(error.message, host, port).toString();
  }
  
  return String(error);
}

/**
 * Check if an error is SSL/TLS related based on error content
 */
export function isSSLError(error: unknown): boolean {
  if (error instanceof TLSError) {
    return true;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('ssl') || 
           message.includes('tls') || 
           message.includes('cert') || 
           message.includes('handshake') ||
           message.includes('secureconnect');
  }
  
  return false;
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
