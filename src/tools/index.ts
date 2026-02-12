import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

// Helper to convert handler results to proper CallToolResult type
function toCallToolResult(result: { content: { type: string; text: string }[]; isError?: boolean }): CallToolResult {
  return {
    content: result.content.map(item => ({
      type: "text" as const,
      text: item.text
    })),
    isError: result.isError ?? false
  };
}

// Register all tools with the MCP server
export function registerTools(server: McpServer): void {
  // Identity tools
  server.registerTool(
    "set_llm_identity",
    {
      title: "Set LLM Identity",
      description: "Set the identity of the connected LLM",
      inputSchema: {
        name: z.string().optional().describe("Name of the LLM (e.g., 'Claude', 'GPT', etc.)"),
        version: z.string().optional().describe("Version of the LLM (e.g., '3.7 Sonnet', '4', etc.)"),
        provider: z.string().optional().describe("Provider of the LLM (e.g., 'Anthropic', 'OpenAI', etc.)"),
        capabilities: z.array(z.string()).optional().describe("List of capabilities the LLM has"),
        metadata: z.record(z.string(), z.string()).optional().describe("Additional metadata about the LLM")
      }
    },
    async (args, _extra) => toCallToolResult(await handleSetLLMIdentityTool(args))
  );

  server.registerTool(
    "get_llm_identity",
    {
      title: "Get LLM Identity",
      description: "Get the current identity of the connected LLM"
    },
    async () => toCallToolResult(await handleGetLLMIdentityTool())
  );

  // Telnet connection tools
  server.registerTool(
    "connect_telnet",
    {
      title: "Connect to Telnet Server",
      description: "Connect to a telnet server by name or host/port. Supports both plain telnet and SSL/TLS encrypted connections.",
      inputSchema: {
        name: z.string().optional().describe("Name of a saved connection to connect to"),
        host: z.string().optional().describe("Hostname or IP address of the telnet server"),
        port: z.number().default(23).describe("Port number (default is 23)"),
        saveName: z.string().optional().describe("Name to save this connection as (for new connections)"),
        tls: z.boolean().default(false).describe("Enable SSL/TLS encryption (default: false)"),
        rejectUnauthorized: z.boolean().optional().describe("Verify SSL/TLS certificates (default: true when tls is enabled)"),
        servername: z.string().optional().describe("Server name for SNI (Server Name Indication) - defaults to host")
      }
    },
    async (args, _extra) => toCallToolResult(await handleConnectTool(args))
  );

  server.registerTool(
    "send_command",
    {
      title: "Send Telnet Command",
      description: "Send a command to the telnet server. Supports an optional 'waitFor' regex pattern: instead of returning after a fixed delay, the server polls the response buffer and returns as soon as the pattern is matched. This is much faster than blind waits. Example: send_command({command: 'LOOK', waitFor: 'You can go'}) returns as soon as room exits appear in the output.",
      inputSchema: {
        command: z.string().describe("Command to send to the telnet server"),
        timeout: z.number().default(30000).describe("Timeout in milliseconds (default: 30000 for normal mode, 2000 for waitFor mode)"),
        waitAfter: z.number().default(0).describe("Seconds to wait after sending the command (0-60). Ignored if waitFor is set."),
        waitFor: z.string().optional().describe("Regex pattern to wait for in the response buffer. The command returns as soon as this pattern is matched (case-insensitive). Much faster than fixed waits. Examples: 'You can go' (room loaded), 'Enter your selection' (menu appeared), 'credits' (balance shown), 'You\\'ve arrived' (walking complete).")
      }
    },
    async (args, _extra) => toCallToolResult(await handleCommandTool(args))
  );

  server.registerTool(
    "get_buffer",
    {
      title: "Get Response Buffer",
      description: "Get the current response buffer without sending a command"
    },
    async () => toCallToolResult(await handleBufferTool())
  );

  server.registerTool(
    "connection_status",
    {
      title: "Get Connection Status",
      description: "Get the current status of the telnet connection",
      inputSchema: {
        toggleContinuousMode: z.boolean().optional().describe("Toggle continuous interaction mode or set to specific value"),
        defaultDelay: z.number().optional().describe("Default delay between commands in seconds (0-60)")
      }
    },
    async (args, _extra) => toCallToolResult(await handleConnectionStatusTool(args))
  );

  server.registerTool(
    "disconnect_telnet",
    {
      title: "Disconnect from Server",
      description: "Disconnect from the telnet server"
    },
    async () => toCallToolResult(await handleDisconnectTool())
  );

  server.registerTool(
    "list_saved_connections",
    {
      title: "List Saved Connections",
      description: "List all saved connections"
    },
    async () => toCallToolResult(await handleListSavedConnectionsTool())
  );

  server.registerTool(
    "get_session_logs",
    {
      title: "Get Session Logs",
      description: "Get telnet session logs with clear session boundaries",
      inputSchema: {
        connectionName: z.string().optional().describe("Filter logs by connection name"),
        startDate: z.string().optional().describe("Filter logs by start date (ISO format)"),
        endDate: z.string().optional().describe("Filter logs by end date (ISO format)"),
        sessionId: z.string().optional().describe("Filter logs by specific session ID")
      }
    },
    async (args, _extra) => toCallToolResult(await handleSessionLogsTool(args))
  );

  server.registerTool(
    "update_connection_memory",
    {
      title: "Update Connection Memory",
      description: "Update memory for a saved connection",
      inputSchema: {
        connectionName: z.string().optional().describe("Name of the saved connection (uses current connection if omitted)"),
        memory: z.string().describe("Memory to save for this connection")
      }
    },
    async (args, _extra) => toCallToolResult(await handleUpdateConnectionMemoryTool(args))
  );

  server.registerTool(
    "get_connection_memory",
    {
      title: "Get Connection Memory",
      description: "Get memory information for a saved connection",
      inputSchema: {
        connectionName: z.string().optional().describe("Name of the saved connection (uses current connection if omitted)")
      }
    },
    async (args, _extra) => toCallToolResult(await handleGetConnectionMemoryTool(args))
  );

  // Time tools
  server.registerTool(
    "wait",
    {
      title: "Wait/Delay",
      description: "Wait for a specified number of seconds before the next command",
      inputSchema: {
        seconds: z.number().default(1).describe("Number of seconds to wait (0-60)")
      }
    },
    async (args, _extra) => toCallToolResult(await handleWaitTool(args))
  );

  server.registerTool(
    "sequence_commands",
    {
      title: "Execute Command Sequence",
      description: "Send a sequence of commands with delays or pattern-based waits between them. Each command can use either a fixed delay (waitAfter) or a regex pattern (waitFor) to determine when to proceed to the next command. Using waitFor is much faster than fixed delays.",
      inputSchema: {
        commands: z.array(
          z.object({
            command: z.string().describe("Command to send"),
            waitAfter: z.number().default(1).describe("Seconds to wait after this command (0-60). Ignored if waitFor is set."),
            waitFor: z.string().optional().describe("Regex pattern to wait for before proceeding to the next command. Overrides waitAfter. Example: 'You can go' to wait for room description.")
          })
        ).describe("List of commands with wait times"),
        timeout: z.number().default(30000).describe("Default timeout in milliseconds for all commands")
      }
    },
    async (args, _extra) => toCallToolResult(await handleSequenceCommandsTool(args))
  );
}
