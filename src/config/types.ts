/**
 * Type definitions for MCP-Telnet configuration
 */

/**
 * Saved connection configuration
 */
export interface SavedConnection {
  name: string;
  host: string;
  port: number;
  isActive: boolean;
  lastUsed?: string;   // ISO date string
  memory?: string;     // Connection-specific memory/notes
}

/**
 * Global server configuration
 */
export interface ServerConfig {
  logLevel: string;
  defaultTimeout: number;
  defaultKeepAliveInterval: number;
  maxReconnectAttempts: number;
  cliPort: number;
}
