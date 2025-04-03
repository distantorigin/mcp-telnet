import * as net from 'net';
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
import { ConnectionError, TimeoutError, NotConnectedError, IdentityError, formatError } from '../utils/errors.js';
import { SavedConnection } from '../config/types.js';
import { 
  startSession, 
  endSession, 
  logSessionEvent, 
  SessionEventType 
} from '../utils/sessionLogging.js';
import { getPackageVersion } from '../utils/version.js';
import { getLLMIdentityString, isLLMIdentified } from '../config/identity.js';

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

// The keep-alive interval and reconnection settings are defined in config/constants.js

// Connect to a telnet server
//
// This is our main connection function - it handles the initial connection,
// sets up event handlers, and manages timeouts. We use the connectionName
// as a key for reconnection and session management.
export async function connect(host: string, port: number, connectionName: string = ""): Promise<{ success: boolean, message: string }> {
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
      telnetClient = net.createConnection({ host, port }, () => {
        setConnectionState({
          isConnected: true,
          host,
          port,
          lastError: "",
          lastCommand: "",
          lastResponse: "",
          name: connectionName || `${host}:${port}`,
        });
        
        // Start a new session log
        startSession(connectionState.name, host, port);
        logSessionEvent(SessionEventType.CONNECTION, `Connected to ${host}:${port} as "${connectionState.name}"`);
        
        // Send initial telnet negotiation to identify as MCP-Telnet with LLM identity
        sendIdentification();
        
        log(`Connected to ${host}:${port} as "${connectionState.name}"`);
        resolve({ success: true, message: `Successfully connected to ${host}:${port}` });
      });

      telnetClient.setTimeout(DEFAULT_TIMEOUT);
      
      // Start keep-alive mechanism
      startKeepAlive();

      telnetClient.on('data', (data) => {
        // Check for and handle telnet commands
        const processedData = processTelnetCommands(data);
        
        if (processedData.length > 0) {
          const text = processedData.toString();
          appendToResponseBuffer(text);
          log(`Received: ${text}`);
          // Don't log raw data packets here as they'll be combined in the final response
          // which will be logged by the sendCommand function
        }
      });

      telnetClient.on('error', (err) => {
        // Store current connection info for potential reconnection
        const currentHost = connectionState.host;
        const currentPort = connectionState.port;
        const currentName = connectionState.name;
        
        // Create proper error object
        const connectionError = new ConnectionError(err.message, currentHost, currentPort);
        
        setConnectionState({
          lastError: connectionError.message,
          isConnected: false
        });
        
        // Check if there's any buffered content to include with the error
        const bufferedContent = getResponseBuffer();
        log(`Connection error: ${err.message}`, 'error');
        
        // Include buffered content in the error log if available
        if (bufferedContent.length > 0) {
          logSessionEvent(SessionEventType.ERROR, `Connection error: ${err.message}\nBuffer content at time of error (${bufferedContent.length} bytes):\n${bufferedContent}`);
        } else {
          logSessionEvent(SessionEventType.ERROR, `Connection error: ${err.message}`);
        }
        if (!telnetClient?.destroyed) {
          telnetClient?.destroy();
        }
        telnetClient = null;
        
        // Stop keep-alive
        stopKeepAlive();
        
        // Try to reconnect in the background if this wasn't a manual disconnect
        if (currentHost && currentPort) {
          setTimeout(() => {
            attemptReconnect(currentHost, currentPort, currentName);
          }, RECONNECT_INITIAL_DELAY);  // Wait before first reconnect attempt
        }
        
        // Update saved connections
        if (connectionState.name) {
          const index = savedConnections.findIndex((conn: SavedConnection) => conn.name === connectionState.name);
          if (index !== -1) {
            savedConnections[index].isActive = false;
            saveSavedConnections();
          }
        }
        
        resolve({ success: false, message: `Connection error: ${err.message}` });
      });

      telnetClient.on('timeout', () => {
        // Store current connection info for potential reconnection
        const currentHost = connectionState.host;
        const currentPort = connectionState.port;
        const currentName = connectionState.name;
        
        // Create timeout error object
        const timeoutError = new TimeoutError("Connection timed out", connectionState.lastCommand);
        
        setConnectionState({
          lastError: timeoutError.message,
          isConnected: false
        });
        
        // Check if there's any buffered content to include with the timeout
        const bufferedContent = getResponseBuffer();
        log("Connection timed out", 'warn');
        
        // Include buffered content in the timeout log if available
        if (bufferedContent.length > 0) {
          logSessionEvent(SessionEventType.TIMEOUT, `Connection timed out\nBuffer content at time of timeout (${bufferedContent.length} bytes):\n${bufferedContent}`);
        } else {
          logSessionEvent(SessionEventType.TIMEOUT, "Connection timed out");
        }
        if (!telnetClient?.destroyed) {
          telnetClient?.destroy();
        }
        telnetClient = null;
        
        // Stop keep-alive
        stopKeepAlive();
        
        // Try to reconnect in the background
        if (currentHost && currentPort) {
          setTimeout(() => {
            attemptReconnect(currentHost, currentPort, currentName);
          }, RECONNECT_INITIAL_DELAY);  // Wait before first reconnect attempt
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
          setTimeout(() => {
            attemptReconnect(currentHost, currentPort, currentName);
          }, RECONNECT_INITIAL_DELAY);  // Wait before first reconnect attempt
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
    
    // Stop keep-alive
    stopKeepAlive();
    
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
      // Clear the buffer first
      clearResponseBuffer();
      setConnectionState({ lastCommand: command });

      // Send the command
      telnetClient.write(`${command}\r\n`);
      log(`Sent: ${command}`);
      logSessionEvent(SessionEventType.COMMAND, `Sent command (${command.length} bytes):\n${command}`);

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
    log(`Attempting to reconnect to ${conn.name} (${conn.host}:${conn.port})`, 'info');
    
    try {
      await connect(conn.host, conn.port, conn.name);
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

// Process telnet commands from incoming data
function processTelnetCommands(data: Buffer): Buffer {
  const processed = Buffer.alloc(data.length * 2); // Allocate more space than needed
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
      // Regular data, copy to processed buffer
      processed[processedIndex++] = data[i++];
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

// Attempt to reconnect if disconnected unexpectedly
async function attemptReconnect(host: string, port: number, name: string): Promise<void> {
  let attempts = 0;
  
  while (attempts < MAX_RECONNECT_ATTEMPTS) {
    attempts++;
    log(`Reconnection attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS} to ${name} (${host}:${port})`);
    
    try {
      const result = await connect(host, port, name);
      if (result.success) {
        log(`Successfully reconnected to ${name} (${host}:${port})`);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Reconnection attempt failed: ${message}`);
    }
    
    // Wait before next attempt (increasing backoff)
    await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
  }
  
  log(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
}
