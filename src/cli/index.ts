import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';
import { executeCommand } from './commands.js';
import { log } from '../utils/logging.js';

// Start the interactive CLI interface
// Default CLI server port
const DEFAULT_CLI_PORT = 9000;

// Start the interactive CLI interface
export function startInteractiveCLI(): void {
  const port = process.env.CLI_PORT ? parseInt(process.env.CLI_PORT, 10) : DEFAULT_CLI_PORT;
  
  // Create TCP server for CLI
  const server = net.createServer((socket) => {
    log(`CLI client connected from ${socket.remoteAddress}:${socket.remotePort}`);
    
    // Create readline interface for this connection
    const rl = readline.createInterface({
      input: socket,
      output: socket,
      terminal: true
    });
    
    // Send welcome message
    socket.write('=== Telnet MCP Server CLI ===\r\n');
    socket.write(`Connected from ${socket.remoteAddress}:${socket.remotePort}\r\n`);
    socket.write('Type "help" for available commands\r\n');
    
    // Set prompt
    rl.setPrompt('telnet-cli> ');
    rl.prompt();
    
    // Handle commands
    rl.on('line', async (line) => {
      try {
        if (line.trim() === 'exit' || line.trim() === 'quit') {
          socket.end('Goodbye!\r\n');
          return;
        }
        
        await executeCommand(line, (text) => {
          // Format output for telnet by replacing newlines with CRLF
          socket.write(text.replace(/\n/g, '\r\n') + '\r\n');
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        socket.write(`Error: ${errorMessage}\r\n`);
      }
      rl.prompt();
    });
    
    // Handle client disconnect
    socket.on('end', () => {
      log(`CLI client disconnected from ${socket.remoteAddress}:${socket.remotePort}`);
    });
    
    // Handle errors
    socket.on('error', (err) => {
      log(`CLI socket error: ${err.message}`);
    });
  });
  
  // Handle server errors
  server.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'EADDRINUSE') {
      log(`CLI port ${port} is already in use. Socket-based CLI not available.`);
    } else {
      log(`CLI server error: ${err.message}`);
    }
    log('Server continues running in headless mode');
  });
  
  // Start listening
  server.listen(port, '127.0.0.1', () => {
    log(`CLI interface available on localhost:${port}`);
    log('Connect using: telnet localhost ' + port + ' or nc localhost ' + port);
  });
}
