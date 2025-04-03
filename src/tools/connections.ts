import { z } from "zod";
import { connect, getConnectionState } from "../connection/index.js";
import { savedConnections } from "../config/index.js";
import { loadSavedConnections, saveSavedConnections } from "../config/loader.js";
import { logSessionEvent, SessionEventType } from "../utils/sessionLogging.js";

/**
 * Handle the list_saved_connections tool
 */
export async function handleListSavedConnectionsTool() {
  // Load connections in case they were modified outside
  loadSavedConnections();
  
  if (savedConnections.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No saved connections found"
        }
      ]
    };
  }
  
  const connectionsList = savedConnections.map((conn: any) => {
    return `- ${conn.name}: ${conn.host}:${conn.port} (${conn.isActive ? 'ACTIVE' : 'inactive'})`;
  }).join('\n');
  
  return {
    content: [
      {
        type: "text",
        text: `Saved connections:\n${connectionsList}`
      }
    ]
  };
}

/**
 * Handle the use_saved_connection tool
 */
export async function handleUseSavedConnectionTool(args: Record<string, unknown>) {
  try {
    const connectionName = z.string().parse(args.name);
    
    // Load connections in case they were modified outside
    loadSavedConnections();
    
    const savedConnection = savedConnections.find((conn: any) => conn.name === connectionName);
    
    if (!savedConnection) {
      return {
        content: [
          {
            type: "text",
            text: `No saved connection found with name "${connectionName}"`
          }
        ],
        isError: true
      };
    }
    
    if (savedConnection.isActive) {
      return {
        content: [
          {
            type: "text",
            text: `Connection "${connectionName}" is already active`
          }
        ]
      };
    }
    
    const result = await connect(savedConnection.host, savedConnection.port, connectionName);
    
    return {
      content: [
        {
          type: "text",
          text: result.message
        }
      ],
      isError: !result.success
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error with saved connection: ${message}`
        }
      ],
      isError: true
    };
  }
}
