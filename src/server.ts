import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfigurations, loadSavedConnections } from './config/loader.js';
import { startInteractiveCLI } from './cli/index.js';
import { reconnectToActiveConnections } from './connection/index.js';
import { registerTools } from './tools/index.js';
import { log } from './utils/logging.js';
import { getPackageVersion } from './utils/version.js';
import { initializeIdentity, getLLMIdentity, isLLMIdentified } from './config/identity.js';

/**
 * Initialize and start the MCP server
 * @returns {Promise<Server>} The initialized MCP server instance
 */
export async function startServer() {
  // Get the package version
  const version = getPackageVersion();
  
  // Create MCP server
  const server = new Server({
    name: "telnet-mcp-server",
    version: version
  }, {
    capabilities: {
      tools: {
        listChanged: true
      },
      resources: {
        listChanged: true
      },
      prompts: {
        listChanged: true
      }
    }
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
  
  // Add handlers for resources and prompts
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [] };
  });
  
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });
  
  // Start interactive CLI
  startInteractiveCLI();
  
  // Only try to reconnect if identity is set
  if (isLLMIdentified()) {
    // Connect to any active connections
    await reconnectToActiveConnections();
  }
  
  // Start the MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP-Telnet server running on stdio");
  
  return server;
}
