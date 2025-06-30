import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handleConnectTool } from './connect.js';
import { handleCommandTool } from './command.js';
import { handleConnectionStatusTool, handleBufferTool } from './status.js';
import { handleDisconnectTool } from './disconnect.js';
import { handleListSavedConnectionsTool } from './connections.js';
import { handleSessionLogsTool } from './logs.js';
import { 
  handleUpdateConnectionMemoryTool,
  handleGetConnectionMemoryTool
} from './connection-memory.js';
import {
  handleSetLLMIdentityTool,
  handleGetLLMIdentityTool
} from './identity.js';
import {
  handleWaitTool,
  handleSequenceCommandsTool
} from './time.js';

// Register all tools with the MCP server
export function registerTools(server: Server): void {
  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Identity tools
        {
          name: "set_llm_identity",
          description: "Set the identity of the connected LLM",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the LLM (e.g., 'Claude', 'GPT', etc.)"
              },
              version: {
                type: "string",
                description: "Version of the LLM (e.g., '3.7 Sonnet', '4', etc.)"
              },
              provider: {
                type: "string",
                description: "Provider of the LLM (e.g., 'Anthropic', 'OpenAI', etc.)"
              },
              capabilities: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "List of capabilities the LLM has"
              },
              metadata: {
                type: "object",
                additionalProperties: {
                  type: "string"
                },
                description: "Additional metadata about the LLM"
              }
            }
          }
        },
        {
          name: "get_llm_identity",
          description: "Get the current identity of the connected LLM",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        
        // Telnet connection tools
        {
          name: "connect_telnet",
          description: "Connect to a telnet server by name or host/port",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of a saved connection to connect to"
              },
              host: {
                type: "string",
                description: "Hostname or IP address of the telnet server"
              },
              port: {
                type: "number",
                description: "Port number (default is 23)",
                default: 23
              },
              saveName: {
                type: "string",
                description: "Name to save this connection as (for new connections)"
              }
            },
            // No required fields to allow connecting by name OR host
          }
        },
        {
          name: "send_command",
          description: "Send a command to the telnet server",
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "Command to send to the telnet server"
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds (default is 30000)",
                default: 30000
              },
              waitAfter: {
                type: "number",
                description: "Seconds to wait after sending the command (0-60)",
                default: 0
              }
            },
            required: ["command"]
          }
        },
        {
          name: "get_buffer",
          description: "Get the current response buffer without sending a command",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "connection_status",
          description: "Get the current status of the telnet connection",
          inputSchema: {
            type: "object",
            properties: {
              toggleContinuousMode: {
                type: "boolean",
                description: "Toggle continuous interaction mode or set to specific value"
              },
              defaultDelay: {
                type: "number",
                description: "Default delay between commands in seconds (0-60)"
              }
            }
          }
        },
        {
          name: "disconnect_telnet",
          description: "Disconnect from the telnet server",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "list_saved_connections",
          description: "List all saved connections",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "get_session_logs",
          description: "Get telnet session logs with clear session boundaries",
          inputSchema: {
            type: "object",
            properties: {
              connectionName: {
                type: "string",
                description: "Filter logs by connection name"
              },
              startDate: {
                type: "string",
                description: "Filter logs by start date (ISO format)"
              },
              endDate: {
                type: "string",
                description: "Filter logs by end date (ISO format)"
              },
              sessionId: {
                type: "string",
                description: "Filter logs by specific session ID"
              }
            }
          }
        },
        {
          name: "update_connection_memory",
          description: "Update memory for a saved connection",
          inputSchema: {
            type: "object",
            properties: {
              connectionName: {
                type: "string",
                description: "Name of the saved connection (uses current connection if omitted)"
              },
              memory: {
                type: "string",
                description: "Memory to save for this connection"
              }
            },
            required: ["memory"]
          }
        },
        {
          name: "get_connection_memory",
          description: "Get memory information for a saved connection",
          inputSchema: {
            type: "object",
            properties: {
              connectionName: {
                type: "string",
                description: "Name of the saved connection (uses current connection if omitted)"
              }
            }
          }
        },
        {
          name: "wait",
          description: "Wait for a specified number of seconds before the next command",
          inputSchema: {
            type: "object",
            properties: {
              seconds: {
                type: "number",
                description: "Number of seconds to wait (0-60)",
                default: 1
              }
            }
          }
        },
        {
          name: "sequence_commands",
          description: "Send a sequence of commands with delays between them",
          inputSchema: {
            type: "object",
            properties: {
              commands: {
                type: "array",
                description: "List of commands with wait times",
                items: {
                  type: "object",
                  properties: {
                    command: {
                      type: "string",
                      description: "Command to send"
                    },
                    waitAfter: {
                      type: "number",
                      description: "Seconds to wait after this command (0-60)",
                      default: 1
                    }
                  },
                  required: ["command"]
                }
              },
              timeout: {
                type: "number",
                description: "Default timeout in milliseconds for all commands",
                default: 30000
              }
            },
            required: ["commands"]
          }
        }
      ]
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    
    switch (name) {
      // Identity tools
      case "set_llm_identity":
        return await handleSetLLMIdentityTool(args);
      case "get_llm_identity":
        return await handleGetLLMIdentityTool();
        
      // Connection tools
      case "connect_telnet":
        return await handleConnectTool(args);
      case "send_command":
        return await handleCommandTool(args);
      case "get_buffer":
        return await handleBufferTool();
      case "connection_status":
        return await handleConnectionStatusTool(args);
      case "disconnect_telnet":
        return await handleDisconnectTool();
      case "list_saved_connections":
        return await handleListSavedConnectionsTool();
      case "get_session_logs":
        return await handleSessionLogsTool(args);
      case "update_connection_memory":
        return await handleUpdateConnectionMemoryTool(args);
      case "get_connection_memory":
        return await handleGetConnectionMemoryTool(args);
        
      // Time tools
      case "wait":
        return await handleWaitTool(args);
      case "sequence_commands":
        return await handleSequenceCommandsTool(args);
        
      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`
            }
          ],
          isError: true
        };
    }
  });
}
