// Connection module exports
export {
  connect,
  disconnect,
  reconnectToActiveConnections,
  sendCommand,
  sendCommandWaitFor,
  isTelnetClientConnected
} from './telnet.js';
export { 
  getConnectionState, 
  setConnectionState, 
  getResponseBuffer,
  clearResponseBuffer,
  appendToResponseBuffer,
  ConnectionState 
} from './state.js';
