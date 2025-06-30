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
}

// Maximum response buffer size to prevent memory exhaustion (256KB)
const MAX_RESPONSE_BUFFER_SIZE = 256 * 1024;

// Connection state
export let responseBuffer = "";
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
};

// Get a copy of the current connection state
export function getConnectionState(): ConnectionState {
  return { ...connectionState };
}

// Update connection state
export function setConnectionState(newState: Partial<ConnectionState>): void {
  connectionState = { ...connectionState, ...newState };
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
