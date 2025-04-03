import { startServer } from './server.js';
import { log } from './utils/logging.js';

// Main entry point for the telnet MCP server
async function main() {
  try {
    await startServer();
    log("Server successfully started");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Fatal error: ${message}`);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  log(`Unhandled exception: ${error.message}`);
  process.exit(1);
});
