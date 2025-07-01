import * as net from 'net';
import * as tls from 'tls';
import { 
  connectionState, 
  setConnectionState, 
  clearResponseBuffer,
  appendToResponseBuffer,
  getResponseBuffer
} from './state.js';
import { savedConnections } from '../config/index.js';
import { 
  DEFAULT_TIMEOUT, 
  KEEP_ALIVE_INTERVAL,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_INITIAL_DELAY,
  RESPONSE_BUFFER_WAIT,
  TELNET
} from '../config/constants.js';
import { saveSavedConnections } from '../config/loader.js';
import { log } from '../utils/logging.js';
import { 
  ConnectionError, 
  TimeoutError, 
  NotConnectedError, 
  IdentityError, 
  TLSError,
  CertificateError,
  HandshakeError,
  formatError, 
  formatSSLError,
  isSSLError,
  sanitizeCommand, 
  sanitizeForLogging 
} from '../utils/errors.js';
import { SavedConnection } from '../config/types.js';
import { 
  startSession, 
  endSession, 
  logSessionEvent, 
  SessionEventType 
} from '../utils/sessionLogging.js';
import { getPackageVersion } from '../utils/version.js';
import { getLLMIdentityString, isLLMIdentified } from '../config/identity.js';

// TLS options interface for SSL/TLS connections
interface TLSOptions {
  tls?: boolean;
  rejectUnauthorized?: boolean;
  servername?: string;
  ca?: string;
  cert?: string;
  key?: string;
  passphrase?: string;
}

// Unpack telnet constants for easier access
const { 
  CMD: { IAC, WILL, WONT, DO, DONT, SB, SE },
  OPT: { TERMINAL_TYPE },
  SUB: { IS, SEND },
  MTTS: { ANSI: MTTS_FLAG_ANSI, UTF8: MTTS_FLAG_UTF8, COLOR_256: MTTS_FLAG_256COLOR }
} = TELNET;

// MTTS subnegotiation constant
const MTTS = 1;  // Not in our constants as it's specific to this module

// Socket connection to telnet server
let telnetClient: net.Socket | null = null;

// Timer for keep-alive mechanism
let keepAliveTimer: NodeJS.Timeout | null = null;

// Track active reconnection timers to prevent leaks
const activeReconnectionTimers = new Set<NodeJS.Timeout>();

// The keep-alive interval and reconnection settings are defined in config/constants.js

// Connect to a telnet server
//
// This is our main connection function - it handles the initial connection,
// sets up event handlers, and manages timeouts. We use the connectionName
// as a key for reconnection and session management.
export async function connect(
  host: string, 
  port: number, 
  connectionName: string = "",
  tlsOptions?: TLSOptions
): Promise<{ success: boolean, message: string }> {
  // Check if LLM identity is set
  if (!isLLMIdentified()) {
    const error = new IdentityError("LLM identity not set. Please use set_llm_identity tool before connecting.");
    log(error.message, 'error');
    return {
      success: false,
      message: error.message
    };
  }
  
  // Reset terminal type state whenever we start a new connection
  terminalTypeState = 0;

  // Close existing connection if any
  await disconnect();

  return new Promise((resolve) => {
    try {
      clearResponseBuffer();
      
      // Create socket based on TLS options
      let socket: net.Socket;
      
      if (tlsOptions?.tls) {
        // TLS connection
        socket = tls.connect({
          host,
          port,
          rejectUnauthorized: tlsOptions.rejectUnauthorized ?? true,
          servername: tlsOptions.servername || host,
          ca: tlsOptions.ca,
          cert: tlsOptions.cert,
          key: tlsOptions.key,
          passphrase: tlsOptions.passphrase
        });
      } else {
        // Plain TCP connection
        socket = net.createConnection({ host, port });
      }
      
      telnetClient = socket;
      
      // Setup connection handler
      const handleConnection = () => {
        setConnectionState({
          isConnected: true,
          host,
          port,
          lastError: "",
          lastCommand: "",
          lastResponse: "",
          name: connectionName || `${host}:${port}`,
          useTLS: tlsOptions?.tls || false,
        });
        
        // Start a new session log
        startSession(connectionState.name, host, port);
        const connectionType = tlsOptions?.tls ? 'SSL/TLS' : 'plain';
        logSessionEvent(SessionEventType.CONNECTION, `Connected to ${host}:${port} as "${connectionState.name}" (${connectionType})`);
        
        // Send initial telnet negotiation to identify as MCP-Telnet with LLM identity
        sendIdentification();
        
        log(`Connected to ${host}:${port} as "${connectionState.name}" (${connectionType})`);
        resolve({ success: true, message: `Successfully connected to ${host}:${port} using ${connectionType}` });
      };
      
      // Setup event handlers based on connection type
      if (tlsOptions?.tls) {
        socket.on('secureConnect', () => {
          const tlsSocket = socket as tls.TLSSocket;
          
          // Update connection state with SSL info
          const sslInfo = {
            authorized: tlsSocket.authorized,
            authorizationError: tlsSocket.authorizationError?.message,
            protocol: tlsSocket.getProtocol() || undefined,
            cipher: tlsSocket.getCipher(),
            certificate: tlsSocket.getPeerCertificate()
          };
          
          setConnectionState({
            sslInfo: sslInfo
          });
          
          // Log SSL connection details
          log(`SSL/TLS connection established. Protocol: ${sslInfo.protocol}, Authorized: ${sslInfo.authorized}`);
          logSessionEvent(SessionEventType.SSL_HANDSHAKE, `SSL/TLS handshake completed. Protocol: ${sslInfo.protocol}`);
          
          if (sslInfo.certificate && typeof sslInfo.certificate === 'object') {
            const cert = sslInfo.certificate;
            const certInfo = `Subject: ${cert.subject?.CN || 'Unknown'}, Issuer: ${cert.issuer?.CN || 'Unknown'}, Valid until: ${cert.valid_to || 'Unknown'}`;
            logSessionEvent(SessionEventType.SSL_CERTIFICATE, `Certificate details: ${certInfo}`);
          }
          
          if (sslInfo.authorizationError) {
            log(`Certificate authorization error: ${sslInfo.authorizationError}`, 'warn');
            logSessionEvent(SessionEventType.SSL_ERROR, `Certificate authorization failed: ${sslInfo.authorizationError}`);
          } else if (sslInfo.authorized) {
            logSessionEvent(SessionEventType.SSL_CERTIFICATE, 'Certificate validation: PASSED');
          }
          
          handleConnection();
        });
        
        socket.on('tlsClientError', (err) => {
          const sslError = HandshakeError.createFromHandshakeError(err, host, port);
          log(`TLS client error: ${sslError.message}`, 'error');
          logSessionEvent(SessionEventType.SSL_ERROR, `TLS client error: ${sslError.message}`);
          setConnectionState({
            lastError: sslError.message,
            isConnected: false
          });
          resolve({ success: false, message: sslError.message });
        });
      } else {
        socket.on('connect', handleConnection);
      }

      telnetClient.setTimeout(DEFAULT_TIMEOUT);
      
      // Start keep-alive mechanism
      startKeepAlive();

      telnetClient.on('data', (data) => {
        // Check for and handle telnet commands
        const processedData = processTelnetCommands(data);
        
        if (processedData.length > 0) {
          const text = processedData.toString();
          appendToResponseBuffer(text);
          log(`Received: ${sanitizeForLogging(text)}`);
          // Don't log raw data packets here as they'll be combined in the final response
          // which will be logged by the sendCommand function
        }
      });

      telnetClient.on('error', (err) => {
        // Store current connection info for potential reconnection
        const currentHost = connectionState.host;
        const currentPort = connectionState.port;
        const currentName = connectionState.name;
        
        // Create appropriate error object based on error type
        let connectionError: ConnectionError;
        
        if (tlsOptions?.tls && isSSLError(err)) {
          // Handle SSL-specific errors
          const errorMessage = err.message.toLowerCase();
          
          if (errorMessage.includes('cert') || errorMessage.includes('certificate')) {
            connectionError = CertificateError.createFromAuthError(err.message, currentHost, currentPort);
          } else if (errorMessage.includes('handshake') || errorMessage.includes('ssl') || errorMessage.includes('tls')) {
            connectionError = HandshakeError.createFromHandshakeError(err, currentHost, currentPort);
          } else {
            connectionError = new TLSError(err.message, currentHost, currentPort);
          }
        } else {
          // Standard connection error
          connectionError = new ConnectionError(err.message, currentHost, currentPort);
        }
        
        setConnectionState({
          lastError: connectionError.message,
          isConnected: false
        });
        
        // Check if there's any buffered content to include with the error
        const bufferedContent = getResponseBuffer();
        const connectionType = tlsOptions?.tls ? 'SSL/TLS' : 'plain';
        log(`${connectionType} connection error: ${connectionError.message}`, 'error');
        
        // Include buffered content in the error log if available
        const eventType = (tlsOptions?.tls && isSSLError(err)) ? SessionEventType.SSL_ERROR : SessionEventType.ERROR;
        if (bufferedContent.length > 0) {
          logSessionEvent(eventType, `${connectionType} connection error: ${connectionError.message}\nBuffer content at time of error (${bufferedContent.length} bytes):\n${bufferedContent}`);
        } else {
          logSessionEvent(eventType, `${connectionType} connection error: ${connectionError.message}`);
        }
        if (!telnetClient?.destroyed) {
          telnetClient?.destroy();
        }
        telnetClient = null;
        
        // Stop keep-alive
        stopKeepAlive();
        
        // Try to reconnect in the background if this wasn't a manual disconnect
        if (currentHost && currentPort) {
          const reconnectTimer = setTimeout(() => {
            activeReconnectionTimers.delete(reconnectTimer);
            attemptReconnect(currentHost, currentPort, currentName);
          }, RECONNECT_INITIAL_DELAY);  // Wait before first reconnect attempt
          activeReconnectionTimers.add(reconnectTimer);
        }
        
        // Update saved connections
        if (connectionState.name) {
          const index = savedConnections.findIndex((conn: SavedConnection) => conn.name === connectionState.name);
          if (index !== -1) {
            savedConnections[index].isActive = false;
            saveSavedConnections();
          }
        }
        
        resolve({ success: false, message: connectionError.message });
      });

      telnetClient.on('timeout', () => {
        // Store current connection info for potential reconnection
        const currentHost = connectionState.host;
        const currentPort = connectionState.port;
        const currentName = connectionState.name;
        
        // Create timeout error object
        const connectionType = tlsOptions?.tls ? 'SSL/TLS' : 'plain';
        const timeoutError = new TimeoutError(`${connectionType} connection timed out`, connectionState.lastCommand);
        
        setConnectionState({
          lastError: timeoutError.message,
          isConnected: false
        });
        
        // Check if there's any buffered content to include with the timeout
        const bufferedContent = getResponseBuffer();
        log(`${connectionType} connection timed out`, 'warn');
        
        // Include buffered content in the timeout log if available
        if (bufferedContent.length > 0) {
          logSessionEvent(SessionEventType.TIMEOUT, `${connectionType} connection timed out\nBuffer content at time of timeout (${bufferedContent.length} bytes):\n${bufferedContent}`);
        } else {
          logSessionEvent(SessionEventType.TIMEOUT, `${connectionType} connection timed out`);
        }
        if (!telnetClient?.destroyed) {
          telnetClient?.destroy();
        }
        telnetClient = null;
        
        // Stop keep-alive
        stopKeepAlive();
        
        // Try to reconnect in the background
        if (currentHost && currentPort) {
          const reconnectTimer = setTimeout(() => {
            activeReconnectionTimers.delete(reconnectTimer);
            attemptReconnect(currentHost, currentPort, currentName);
          }, RECONNECT_INITIAL_DELAY);  // Wait before first reconnect attempt
          activeReconnectionTimers.add(reconnectTimer);
        }
        
        // Update saved connections
        if (connectionState.name) {
          const index = savedConnections.findIndex((conn: SavedConnection) => conn.name === connectionState.name);
          if (index !== -1) {
            savedConnections[index].isActive = false;
            saveSavedConnections();
          }
        }
        
        resolve({ success: false, message: "Connection timed out" });
      });

      telnetClient.on('close', () => {
        // Store current connection info for potential reconnection
        const currentHost = connectionState.host;
        const currentPort = connectionState.port;
        const currentName = connectionState.name;
        const wasConnected = connectionState.isConnected;
        
        setConnectionState({ isConnected: false });
        log("Connection closed");
        
        // Stop keep-alive
        stopKeepAlive();
        
        // Try to reconnect in the background if this wasn't a manual disconnect
        // and if we were previously connected (to avoid reconnecting after manual disconnect)
        if (wasConnected && currentHost && currentPort) {
          const reconnectTimer = setTimeout(() => {
            activeReconnectionTimers.delete(reconnectTimer);
            attemptReconnect(currentHost, currentPort, currentName);
          }, RECONNECT_INITIAL_DELAY);  // Wait before first reconnect attempt
          activeReconnectionTimers.add(reconnectTimer);
        }
        
        // Update saved connections
        if (connectionState.name) {
          const index = savedConnections.findIndex((conn: SavedConnection) => conn.name === connectionState.name);
          if (index !== -1) {
            savedConnections[index].isActive = false;
            saveSavedConnections();
          }
        }
      });

    } catch (error) {
      const errorMessage = formatError(error);
      const connectionError = new ConnectionError(errorMessage, host, port);
      
      setConnectionState({
        lastError: connectionError.message,
        isConnected: false
      });
      
      log(`Failed to connect: ${errorMessage}`, 'error');
      resolve({ success: false, message: `Failed to connect: ${errorMessage}` });
    }
  });
}

// Close the current telnet connection
//
// This sends a proper disconnect and cleans up resources.
// It also updates the connection state and saved configs.
export async function disconnect(): Promise<{ success: boolean, message: string }> {
  if (!telnetClient || telnetClient.destroyed || !connectionState.isConnected) {
    const error = new NotConnectedError();
    return { success: false, message: error.message };
  }

  try {
    const host = connectionState.host;
    const port = connectionState.port;
    const name = connectionState.name;
    
    // Clean up all timers
    cleanupTimers();
    
    logSessionEvent(SessionEventType.DISCONNECTION, `Disconnected from ${host}:${port} (${name})`);
    endSession();
    
    telnetClient.destroy();
    telnetClient = null;
    setConnectionState({ isConnected: false });
    
    // Update saved connections
    const index = savedConnections.findIndex((conn: SavedConnection) => conn.name === name);
    if (index !== -1) {
      savedConnections[index].isActive = false;
      saveSavedConnections();
    }
    
    return { success: true, message: `Disconnected from ${host}:${port}` };
  } catch (error) {
    const errorMessage = formatError(error);
    log(`Error disconnecting: ${errorMessage}`, 'error');
    return { success: false, message: `Error disconnecting: ${errorMessage}` };
  }
}

// Send a command and wait for the response
//
// The tricky part here is that telnet doesn't really have a clear
// boundary for when a response is "done" - so we wait a bit to see
// if more data arrives. After 500ms of no new data, we assume the response is complete.
export async function sendCommand(command: string, timeout = DEFAULT_TIMEOUT): Promise<{ success: boolean, response: string }> {
  return new Promise((resolve) => {
    if (!telnetClient || telnetClient.destroyed || !connectionState.isConnected) {
      const error = new NotConnectedError();
      resolve({ success: false, response: error.message });
      return;
    }

    try {
      // Sanitize the command for security
      const sanitizedCommand = sanitizeCommand(command);
      if (sanitizedCommand !== command) {
        log(`Command sanitized: removed ${command.length - sanitizedCommand.length} characters`, 'warn');
      }

      // Clear the buffer first
      clearResponseBuffer();
      setConnectionState({ lastCommand: sanitizedCommand });

      // Send the sanitized command
      telnetClient.write(`${sanitizedCommand}\r\n`);
      log(`Sent: ${sanitizeForLogging(sanitizedCommand)}`);
      logSessionEvent(SessionEventType.COMMAND, `Sent command (${sanitizedCommand.length} bytes):\n${sanitizeForLogging(sanitizedCommand)}`);

      // Set up a timeout for the response
      const timeoutId = setTimeout(() => {
        const buffer = getResponseBuffer();
        const timeoutError = new TimeoutError(`Command timed out after ${timeout}ms`, command);
        
        // Log the partial response in case of timeout
        logSessionEvent(
          SessionEventType.RESPONSE, 
          `Partial response (timeout after ${timeout}ms, ${buffer.length} bytes):\n${buffer}`
        );
        
        resolve({ 
          success: true, 
          response: `${timeoutError.message}.\nPartial response:\n${buffer}` 
        });
      }, timeout);

      // Wait for the response to accumulate, but keep it short for responsiveness
      // Wait a bit for output to accumulate. 500ms is a compromise - some MUDs are chatty
      // and send output in chunks, while others send it all at once. Tried more complex
      // detection but this simple approach works better with diverse servers.
      setTimeout(() => {
        clearTimeout(timeoutId);
        const buffer = getResponseBuffer();
        setConnectionState({ lastResponse: buffer });
        
        // Add continuation markers if continuous mode is enabled
        const continuousModeEnabled = connectionState.continuousEngagementActive;
        let formattedResponse = buffer;
        
        if (continuousModeEnabled) {
          formattedResponse = `${buffer}\n\n[Waiting for your next command or instruction...]`;
        }
        
        // Log the full response text to the session log with byte count
        logSessionEvent(
          SessionEventType.RESPONSE, 
          `Received response (${buffer.length} bytes):\n${buffer}`
        );
        
        resolve({ success: true, response: formattedResponse });
        log(`Command complete, got ${buffer.length} bytes, continuous mode: ${continuousModeEnabled}`);
      }, RESPONSE_BUFFER_WAIT); // Wait for response to accumulate (optimized for responsiveness)

    } catch (error) {
      const errorMessage = formatError(error);
      log(`Error sending command: ${errorMessage}`, 'error');
      resolve({ success: false, response: `Error sending command: ${errorMessage}` });
    }
  });
}

/**
 * Reconnect to any active saved connections from previous sessions
 * This is called at startup to restore previous connections
 * @returns Promise resolving when reconnection attempt is complete
 */
export async function reconnectToActiveConnections(): Promise<void> {
  const activeConnections = savedConnections.filter((conn: SavedConnection) => conn.isActive);
  if (activeConnections.length > 0) {
    log(`Found ${activeConnections.length} active connections`);
    
    // Connect to the first active connection
    const conn = activeConnections[0];
    const connectionType = conn.tls ? 'SSL/TLS' : 'plain';
    log(`Attempting to reconnect to ${conn.name} (${conn.host}:${conn.port}) using ${connectionType}`, 'info');
    
    // Extract TLS options from saved connection
    const tlsOptions = {
      tls: conn.tls,
      rejectUnauthorized: conn.rejectUnauthorized,
      servername: conn.servername,
      ca: conn.ca,
      cert: conn.cert,
      key: conn.key,
      passphrase: conn.passphrase
    };
    
    try {
      await connect(conn.host, conn.port, conn.name, tlsOptions);
    } catch (error) {
      const errorMessage = formatError(error);
      log(`Failed to reconnect: ${errorMessage}`, 'error');
      
      // Mark as inactive
      const index = savedConnections.findIndex((c: SavedConnection) => c.name === conn.name);
      if (index !== -1) {
        savedConnections[index].isActive = false;
        saveSavedConnections();
      }
    }
  }
}

// Get telnet client status
export function isTelnetClientConnected(): boolean {
  return telnetClient !== null && !telnetClient.destroyed && connectionState.isConnected;
}

// Maximum buffer size to prevent memory exhaustion (1MB)
const MAX_BUFFER_SIZE = 1024 * 1024;

// Process telnet commands from incoming data
function processTelnetCommands(data: Buffer): Buffer {
  // Prevent processing oversized buffers
  if (data.length > MAX_BUFFER_SIZE) {
    log(`Warning: Dropping oversized buffer (${data.length} bytes)`, 'warn');
    return Buffer.alloc(0);
  }
  
  const processed = Buffer.alloc(Math.min(data.length * 2, MAX_BUFFER_SIZE)); // Safe allocation with bounds
  let processedIndex = 0;
  let i = 0;
  
  while (i < data.length) {
    // Check for IAC (Interpret As Command)
    if (data[i] === IAC) {
      i++; // Move past IAC
      
      // Handle telnet commands
      if (i < data.length) {
        switch (data[i]) {
          case DO:
            i++; // Move past DO
            
            if (i < data.length) {
              const option = data[i];
              handleDO(option);
            }
            break;
            
          case DONT:
            i++; // Move past DONT
            
            if (i < data.length) {
              const option = data[i];
              handleDONT(option);
            }
            break;
            
          case WILL:
          case WONT:
            i++; // Skip these commands
            if (i < data.length) i++; // Skip option
            break;
            
          case SB:
            // Handle subnegotiation
            i++; // Move past SB
            
            // Find the end of subnegotiation (IAC SE)
            let start = i;
            while (i < data.length && !(data[i] === IAC && i + 1 < data.length && data[i + 1] === SE)) {
              i++;
            }
            
            if (i < data.length) {
              const subNegotiationData = data.slice(start, i);
              handleSubnegotiation(subNegotiationData);
              i += 2; // Skip IAC SE
            }
            break;
            
          default:
            i++; // Skip unknown command
            break;
        }
      }
    } else {
      // Regular data, copy to processed buffer with bounds check
      if (processedIndex < processed.length) {
        processed[processedIndex++] = data[i++];
      } else {
        // Buffer full, skip remaining data and log warning
        log(`Warning: Processed buffer full, dropping ${data.length - i} bytes`, 'warn');
        break;
      }
    }
  }
  
  // Return only the processed portion
  return processed.slice(0, processedIndex);
}

// Handle DO command
function handleDO(option: number): void {
  if (!telnetClient) return;
  
  switch (option) {
    case TERMINAL_TYPE:
      // Server is asking for terminal type, send WILL TERMINAL_TYPE
      log(`Server requested terminal type, sending WILL TERMINAL_TYPE`);
      const willTerminal = Buffer.from([IAC, WILL, TERMINAL_TYPE]);
      telnetClient.write(willTerminal);
      break;
      
    default:
      // Reject any other options
      const wontBuffer = Buffer.from([IAC, WONT, option]);
      telnetClient.write(wontBuffer);
      break;
  }
}

// Handle DONT command
function handleDONT(option: number): void {
  if (!telnetClient) return;
  
  // Always acknowledge DONT with WONT
  const wontBuffer = Buffer.from([IAC, WONT, option]);
  telnetClient.write(wontBuffer);
  
  // If this is TERMINAL_TYPE, reset the terminal type state
  if (option === TERMINAL_TYPE) {
    terminalTypeState = 0;
    log('Terminal type negotiation reset due to DONT');
  }
}

// Handle subnegotiation
function handleSubnegotiation(data: Buffer): void {
  if (!telnetClient || data.length < 2) return;
  
  const option = data[0];
  
  switch (option) {
    case TERMINAL_TYPE:
      if (data[1] === 1) { // SEND command
        sendTerminalType();
      }
      break;
  }
}

// Send identification using MTTS
function sendIdentification(): void {
  if (!telnetClient) return;
  
  // Inform server we're willing to negotiate terminal type
  const willTerminal = Buffer.from([IAC, WILL, TERMINAL_TYPE]);
  telnetClient.write(willTerminal);
  
  log(`Sent terminal type negotiation`);
}

// Terminal type state tracking
let terminalTypeState = 0; // 0 = client name, 1 = terminal type, 2 = MTTS, 3 = repeat MTTS

// Send terminal type according to MTTS specification
function sendTerminalType(): void {
  if (!telnetClient) return;
  
  // Get the package version
  const version = getPackageVersion();
  
  // Get the LLM identity string
  const llmIdentity = getLLMIdentityString();
  
  // Log LLM identity info for debugging
  log(`Current LLM identity: ${llmIdentity}, isIdentified: ${isLLMIdentified()}`);
  
  // Choose the response based on current state
  let response = "";
  
  switch (terminalTypeState) {
    case 0: // First response - Client name with LLM identity
      if (isLLMIdentified()) {
        // Format: MCP-TELNET-0.2.0/Claude/3.7 Sonnet (Anthropic)
        response = `MCP-TELNET-${version}/${llmIdentity}`;
        log(`Sending client name with LLM identity (1/4): ${response}`);
      } else {
        response = `MCP-TELNET-${version}`;
        log(`Sending client name without LLM identity (1/4): ${response}`);
      }
      terminalTypeState = 1;
      break;
      
    case 1: // Second response - Terminal type
      response = "XTERM";
      log(`Sending terminal type (2/4): ${response}`);
      terminalTypeState = 2;
      break;
      
    case 2: // Third response - MTTS bitvector
      // Calculate the MTTS flags
      const flags = 
        MTTS_FLAG_UTF8 |       // Support UTF-8 
        MTTS_FLAG_ANSI |       // Support ANSI colors
        MTTS_FLAG_256COLOR;    // Support 256 colors
      
      response = `MTTS ${flags}`;
      log(`Sending MTTS capabilities (3/4): ${response}`);
      terminalTypeState = 3;
      break;
      
    case 3: // Fourth response - Repeat MTTS to end cycle
      // Use same flags as in state 2
      const repeatFlags = 
        MTTS_FLAG_UTF8 | 
        MTTS_FLAG_ANSI | 
        MTTS_FLAG_256COLOR;
      
      response = `MTTS ${repeatFlags}`;
      log(`Sending MTTS cycle end (4/4): ${response}`);
      // Keep state at 3 as per spec if more requests come in
      break;
  }
  
  // Construct the subnegotiation sequence
  // IAC SB TERMINAL-TYPE IS "response" IAC SE
  // Add some extra space to buffer for safety (5 bytes for IAC/SB/etc + response length)
  const buffer = Buffer.alloc(response.length + 10); // Extra margin just in case
  let offset = 0;
  
  // Add header bytes
  buffer[offset++] = IAC;
  buffer[offset++] = SB;
  buffer[offset++] = TERMINAL_TYPE;
  buffer[offset++] = IS;  // IS = 0
  
  // Copy the response string
  offset += buffer.write(response, offset);
  
  // Add footer bytes
  buffer[offset++] = IAC;
  buffer[offset++] = SE;
  
  // Send to server
  telnetClient.write(buffer);
}

// Start sending periodic keep-alive packets
function startKeepAlive(): void {
  // Don't create duplicate timers
  stopKeepAlive();
  
  // Set up recurring timer
  keepAliveTimer = setInterval(() => {
    if (isTelnetClientConnected()) {
      // Send a null byte as a keep-alive message
      telnetClient?.write(Buffer.from([0]));
      log("Sent keep-alive packet");
    } else {
      // Stop keep-alive if disconnected
      stopKeepAlive();
    }
  }, KEEP_ALIVE_INTERVAL);
  
  log("Keep-alive mechanism started");
}

// Stop sending keep-alive packets
function stopKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    log("Keep-alive stopped");
  }
}

// Clean up all active timers
function cleanupTimers(): void {
  stopKeepAlive();
  
  // Clear all active reconnection timers
  for (const timer of activeReconnectionTimers) {
    clearTimeout(timer);
  }
  activeReconnectionTimers.clear();
  log("All timers cleaned up");
}

// Attempt to reconnect if disconnected unexpectedly with exponential backoff
async function attemptReconnect(host: string, port: number, name: string): Promise<void> {
  let attempts = 0;
  
  // Find the saved connection to retrieve TLS settings
  const savedConnection = savedConnections.find((conn: SavedConnection) => conn.name === name);
  const tlsOptions = savedConnection ? {
    tls: savedConnection.tls,
    rejectUnauthorized: savedConnection.rejectUnauthorized,
    servername: savedConnection.servername,
    ca: savedConnection.ca,
    cert: savedConnection.cert,
    key: savedConnection.key,
    passphrase: savedConnection.passphrase
  } : undefined;
  
  while (attempts < MAX_RECONNECT_ATTEMPTS) {
    attempts++;
    const connectionType = tlsOptions?.tls ? 'SSL/TLS' : 'plain';
    log(`Reconnection attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS} to ${name} (${host}:${port}) using ${connectionType}`);
    
    try {
      const result = await connect(host, port, name, tlsOptions);
      if (result.success) {
        log(`Successfully reconnected to ${name} (${host}:${port}) using ${connectionType}`);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Reconnection attempt failed: ${message}`);
    }
    
    // Exponential backoff: 2^attempts * base delay (1000ms), capped at 30 seconds
    const baseDelay = 1000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts - 1), 30000);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    const totalDelay = exponentialDelay + jitter;
    
    log(`Waiting ${Math.round(totalDelay)}ms before next reconnection attempt`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));
  }
  
  log(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
}
