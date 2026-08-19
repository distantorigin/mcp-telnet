import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfigurations, loadSavedConnections } from './config/loader.js';
import { startInteractiveCLI } from './cli/index.js';
import { reconnectToActiveConnections } from './connection/index.js';
import { registerTools } from './tools/index.js';
import { log } from './utils/logging.js';
import { getPackageVersion } from './utils/version.js';
import { initializeIdentity, getLLMIdentity, isLLMIdentified } from './config/identity.js';

/**
 * Initialize and start the MCP server
 * @returns {Promise<McpServer>} The initialized MCP server instance
 */
export async function startServer() {
  // Get the package version
  const version = getPackageVersion();

  // Create MCP server
  const server = new McpServer({
    name: "telnet-mcp-server",
    version: version
  });

  // Load configurations and saved connections
  loadConfigurations();
  loadSavedConnections();
  
  // Initialize identity system
  initializeIdentity();
  
  // Display startup message
  log(`
========================================================
MCP-Telnet v${version} started
========================================================`);

  // Check if LLM identity is set
  if (!isLLMIdentified()) {
    log(`
WARNING: LLM identity not set. Telnet connections will be blocked.
Please use the set_llm_identity tool to identify your LLM:

Example:
  set_llm_identity with:
  {
    "name": "Claude",
    "version": "3.7 Sonnet", 
    "provider": "Anthropic"
  }
========================================================`);
  } else {
    const identity = getLLMIdentity();
    log(`LLM identity: ${identity.name}/${identity.version} (${identity.provider})
========================================================`);
  }
  
  // Register all tools
  registerTools(server);

  // Start interactive CLI
  startInteractiveCLI();

  // Start the MCP server before touching the network. Restoring a previous
  // telnet connection can stall for as long as the socket timeout when the
  // host is gone, and blocking here means the client never sees a response
  // to `initialize` and reports the server as failed to start.
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP-Telnet server running on stdio");

  // Only try to reconnect if identity is set. This runs in the background so
  // an unreachable host degrades to "not connected" instead of taking the
  // whole server down with it.
  if (isLLMIdentified()) {
    reconnectToActiveConnections().catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      log(`Background reconnect failed: ${message}`, 'error');
    });
  }

  return server;
}
