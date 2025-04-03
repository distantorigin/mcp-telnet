#!/usr/bin/env node

import { startServer } from './server.js';
import { log } from './utils/logging.js';
import { getPackageVersion } from './utils/version.js';

// Main CLI entry point
async function main() {
  try {
    const version = getPackageVersion();
    log(`Starting MCP-Telnet v${version}...`);
    
    // Start the server
    await startServer();
    
    log("MCP-Telnet started successfully");
    log("Add to Claude Desktop by updating your claude-desktop-config.json:");
    log(`
{
  "mcpServers": {
    "telnet": {
      "command": "npx",
      "args": ["mcp-telnet"]
    }
  }
}
`);
    log("CLI is available at localhost:9000 (telnet localhost 9000)");
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Fatal error: ${message}`);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  log("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  log("Received SIGTERM, shutting down...");
  process.exit(0);
});

// Start the application
main().catch(error => {
  log(`Unhandled exception: ${error.message}`);
  process.exit(1);
});
