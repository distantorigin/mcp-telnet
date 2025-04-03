import { 
  connect, 
  disconnect, 
  sendCommand, 
  getConnectionState,
  setConnectionState
} from '../connection/index.js';
import { configurations, savedConnections } from '../config/index.js';
import { saveSavedConnections } from '../config/loader.js';

type OutputWriter = (text: string) => void;

interface LoginSequence {
  commands: string[];
  expectedResponses?: string[];
  delayBetweenCommands?: number;
}

interface ConfigWithLogin {
  name: string;
  host: string;
  port: number;
  loginSequence?: LoginSequence;
}

/**
 * Execute a CLI command
 */
export async function executeCommand(command: string, writer: OutputWriter): Promise<void> {
  const cmd = command.trim();
  
  if (cmd === 'help') {
    showHelp(writer);
    return;
  }
  
  if (cmd === 'list') {
    listConfigurations(writer);
    return;
  }
  
  if (cmd === 'status') {
    showStatus(writer);
    return;
  }
  
  if (cmd === 'continuous' || cmd.startsWith('continuous ')) {
    await toggleContinuousMode(cmd, writer);
    return;
  }
  
  if (cmd === 'disconnect') {
    await disconnectCommand(writer);
    return;
  }
  
  if (cmd.startsWith('connect ')) {
    const configName = cmd.substring(8).trim();
    await connectCommand(configName, writer);
    return;
  }
  
  if (cmd.startsWith('send ')) {
    const text = cmd.substring(5);
    await sendCommandText(text, writer);
    return;
  }
  
  if (cmd === 'exit') {
    writer('CLI terminated. MCP server still running.\n');
    return;
  }
  
  writer(`Unknown command: ${cmd}\n`);
  writer('Type "help" for available commands\n');
}

/**
 * Show help text
 */
function showHelp(writer: OutputWriter): void {
  writer('Available commands:\n');
  writer('  connect <config_name> - Connect using a saved configuration\n');
  writer('  send <text> - Send a command to the current connection\n');
  writer('  disconnect - Disconnect the current session\n');
  writer('  list - List available configurations\n');
  writer('  status - Show current connection status\n');
  writer('  continuous [on|off] - Toggle or set continuous interaction mode\n');
  writer('  exit - Exit the CLI\n');
  writer('  help - Show this help\n');
}

/**
 * List available configurations
 */
function listConfigurations(writer: OutputWriter): void {
  writer('Available configurations:\n');
  configurations.forEach((config: any) => {
    writer(`  ${config.name} - ${config.host}:${config.port}\n`);
  });
}

/**
 * Show current connection status
 */
function showStatus(writer: OutputWriter): void {
  const state = getConnectionState();
  if (state.isConnected) {
    writer(`Connected to ${state.host}:${state.port} as "${state.name}"\n`);
    writer(`Buffer size: ${state.lastResponse.length} characters\n`);
    writer(`Continuous mode: ${state.continuousEngagementActive ? 'ENABLED' : 'disabled'}\n`);
  } else {
    writer('Not connected\n');
    if (state.lastError) {
      writer(`Last error: ${state.lastError}\n`);
    }
  }
}

/**
 * Toggle or set continuous mode
 */
async function toggleContinuousMode(command: string, writer: OutputWriter): Promise<void> {
  const state = getConnectionState();
  
  // Parse the command to check if explicit on/off was specified
  const parts = command.split(' ');
  let newValue: boolean | undefined = undefined;
  
  if (parts.length > 1) {
    const setting = parts[1].toLowerCase();
    if (setting === 'on' || setting === 'true' || setting === '1') {
      newValue = true;
    } else if (setting === 'off' || setting === 'false' || setting === '0') {
      newValue = false;
    }
  }
  
  // Toggle or set the mode
  if (newValue !== undefined) {
    setConnectionState({ continuousEngagementActive: newValue });
    writer(`Continuous mode ${newValue ? 'enabled' : 'disabled'}\n`);
  } else {
    // Toggle mode
    const currentValue = state.continuousEngagementActive;
    setConnectionState({ continuousEngagementActive: !currentValue });
    writer(`Continuous mode ${!currentValue ? 'enabled' : 'disabled'}\n`);
  }
}

/**
 * Handle disconnect command
 */
async function disconnectCommand(writer: OutputWriter): Promise<void> {
  const state = getConnectionState();
  if (!state.isConnected) {
    writer('Not connected\n');
    return;
  }
  
  const result = await disconnect();
  if (result.success) {
    writer(`${result.message}\n`);
  } else {
    writer(`Error: ${result.message}\n`);
  }
}

/**
 * Handle connect command
 */
async function connectCommand(configName: string, writer: OutputWriter): Promise<void> {
  const config = configurations.find((c: any) => c.name === configName) as ConfigWithLogin | undefined;
  
  if (!config) {
    writer(`Configuration "${configName}" not found\n`);
    return;
  }
  
  writer(`Connecting to ${config.host}:${config.port}...\n`);
  const result = await connect(config.host, config.port, configName);
  
  if (!result.success) {
    writer(`Failed to connect: ${result.message}\n`);
    return;
  }
  
  writer(`Connected to ${config.host}:${config.port}\n`);
  
  // Run login sequence if provided
  if (config.loginSequence) {
    const loginSequence = config.loginSequence;
    
    if (loginSequence.commands && loginSequence.commands.length > 0) {
      writer(`Running login sequence...\n`);
      
      for (let i = 0; i < loginSequence.commands.length; i++) {
        const command = loginSequence.commands[i];
        const expectedResponse = loginSequence.expectedResponses?.[i];
        
        // Wait for expected response before sending command if specified
        if (expectedResponse) {
          writer(`Waiting for "${expectedResponse}" before sending command...\n`);
          let waitTime = 0;
          const maxWaitTime = 10000; // 10 seconds max wait time
          let matched = false;
          
          while (!matched && waitTime < maxWaitTime) {
            const buffer = getConnectionState().lastResponse;
            matched = buffer.includes(expectedResponse);
            
            if (!matched) {
              await new Promise(resolve => setTimeout(resolve, 500));
              waitTime += 500;
            }
          }
          
          if (!matched) {
            writer(`Timeout waiting for "${expectedResponse}"\n`);
            if (i === 0) {
              writer(`Login sequence aborted due to timeout on initial expectation\n`);
              break;
            }
          } else {
            writer(`Found expected response\n`);
          }
        }
        
        writer(`Sending: ${command}\n`);
        const sendResult = await sendCommand(command);
        
        if (!sendResult.success) {
          writer(`Error in login sequence: ${sendResult.response}\n`);
          break;
        }
        
        // Delay between commands if specified
        const commandDelay = loginSequence.delayBetweenCommands || 1000; // Default to 1 second
        if (i < loginSequence.commands.length - 1) {
          writer(`Waiting ${commandDelay}ms before next command...\n`);
          await new Promise(resolve => setTimeout(resolve, commandDelay));
        }
      }
      writer(`Login sequence completed\n`);
    }
  }
  
  // Add to saved connections
  const existingIndex = savedConnections.findIndex((conn: any) => conn.name === configName);
  if (existingIndex !== -1) {
    savedConnections[existingIndex].isActive = true;
  } else {
    savedConnections.push({
      name: configName,
      host: config.host,
      port: config.port,
      isActive: true
    });
  }
  saveSavedConnections();
}

/**
 * Handle send command
 */
async function sendCommandText(text: string, writer: OutputWriter): Promise<void> {
  const state = getConnectionState();
  if (!state.isConnected) {
    writer('Not connected\n');
    return;
  }
  
  writer(`Sending: ${text}\n`);
  const result = await sendCommand(text);
  
  if (!result.success) {
    writer(`Error: ${result.response}\n`);
  } else {
    writer(`Response:\n${result.response}\n`);
  }
}
