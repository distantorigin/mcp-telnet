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
  
  // SSL/TLS configuration options
  /** Enable SSL/TLS encryption for this connection */
  tls?: boolean;
  /** Verify SSL/TLS certificates (default: true when tls is enabled) */
  rejectUnauthorized?: boolean;
  /** Server name for SNI (Server Name Indication) - defaults to host */
  servername?: string;
  /** Custom Certificate Authority certificate(s) in PEM format */
  ca?: string;
  /** Client certificate in PEM format for mutual TLS authentication */
  cert?: string;
  /** Client private key in PEM format for mutual TLS authentication */
  key?: string;
  /** Passphrase for encrypted private key */
  passphrase?: string;
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
