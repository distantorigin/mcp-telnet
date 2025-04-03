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

// Append text to the response buffer
export function appendToResponseBuffer(text: string): void {
  responseBuffer += text;
}

// Get the current response buffer content
export function getResponseBuffer(): string {
  return responseBuffer;
}
