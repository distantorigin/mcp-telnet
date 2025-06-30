// Manages the state of the telnet connection
export interface ConnectionState {
  isConnected: boolean;
  host: string;
  port: number;
  lastError: string;
  lastCommand: string;
  lastResponse: string;
  name: string;
  continuousEngagementActive: boolean;
  defaultDelay: number;
  
  // SSL/TLS connection information
  /** Whether this connection is using TLS/SSL encryption */
  useTLS?: boolean;
  /** SSL/TLS connection details and certificate information */
  sslInfo?: {
    /** Whether the SSL certificate is authorized/valid */
    authorized: boolean;
    /** Authorization error message if certificate validation failed */
    authorizationError?: string;
    /** SSL/TLS protocol version (e.g., 'TLSv1.3') */
    protocol?: string;
    /** Cipher suite information */
    cipher?: any;
    /** Peer certificate details */
    certificate?: any;
  };
}

// Maximum response buffer size to prevent memory exhaustion (256KB)
const MAX_RESPONSE_BUFFER_SIZE = 256 * 1024;

// Connection state with mutex-like protection
export let responseBuffer = "";
let isUpdatingState = false;
export let connectionState: ConnectionState = {
  isConnected: false,
  host: "",
  port: 0,
  lastError: "",
  lastCommand: "",
  lastResponse: "",
  name: "",
  continuousEngagementActive: false,
  defaultDelay: 0,
  useTLS: false,
  sslInfo: undefined,
};

// Get a copy of the current connection state
export function getConnectionState(): ConnectionState {
  return { ...connectionState };
}

// Update connection state with race condition protection
export function setConnectionState(newState: Partial<ConnectionState>): void {
  // Simple semaphore to prevent concurrent state updates
  if (isUpdatingState) {
    // If already updating, queue this update by setting a timeout
    setTimeout(() => setConnectionState(newState), 0);
    return;
  }
  
  isUpdatingState = true;
  try {
    connectionState = { ...connectionState, ...newState };
  } finally {
    isUpdatingState = false;
  }
}

// Clear the response buffer
export function clearResponseBuffer(): void {
  responseBuffer = "";
}

// Append text to the response buffer with size limit
export function appendToResponseBuffer(text: string): void {
  const newLength = responseBuffer.length + text.length;
  
  if (newLength > MAX_RESPONSE_BUFFER_SIZE) {
    // If adding this text would exceed the limit, truncate from the beginning
    const excessLength = newLength - MAX_RESPONSE_BUFFER_SIZE;
    responseBuffer = responseBuffer.slice(excessLength) + text;
    
    // Log a warning about buffer truncation
    console.warn(`Response buffer truncated: removed ${excessLength} characters to stay within ${MAX_RESPONSE_BUFFER_SIZE} byte limit`);
  } else {
    responseBuffer += text;
  }
}

// Get the current response buffer content
export function getResponseBuffer(): string {
  return responseBuffer;
}
