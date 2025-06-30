import { z } from "zod";
import { getConnectionState } from "../connection/index.js";
import { savedConnections } from "../config/index.js";
import { saveSavedConnections } from "../config/loader.js";
import { log } from "../utils/logging.js";
import { logSessionEvent, SessionEventType } from "../utils/sessionLogging.js";

/**
 * Handle the update_connection_memory tool
 */
export async function handleUpdateConnectionMemoryTool(args: Record<string, unknown>) {
  try {
    const params = z.object({
      connectionName: z.string().optional(),
      memory: z.string()
    }).parse(args);
    
    // Get the connection name from current connection or from params
    const state = getConnectionState();
    const connectionName = params.connectionName || state.name;
    
    if (!connectionName) {
      return {
        content: [
          {
            type: "text",
            text: "No connection name specified and no active connection"
          }
        ],
        isError: true
      };
    }
    
    // Find the connection in saved connections
    const index = savedConnections.findIndex((conn: any) => conn.name === connectionName);
    
    if (index === -1) {
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
    
    // Update memory
    savedConnections[index].memory = params.memory;
    saveSavedConnections();
    logSessionEvent(SessionEventType.SYSTEM, `Updated memory for connection "${connectionName}"`);
    
    return {
      content: [
        {
          type: "text",
          text: `Memory for connection "${connectionName}" updated successfully`
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error updating connection memory: ${message}`
        }
      ],
      isError: true
    };
  }
}



/**
 * Handle the get_connection_memory tool
 */
export async function handleGetConnectionMemoryTool(args: Record<string, unknown>) {
  try {
    const params = z.object({
      connectionName: z.string().optional()
    }).parse(args);
    
    // Get the connection name from current connection or from params
    const state = getConnectionState();
    const connectionName = params.connectionName || state.name;
    
    if (!connectionName) {
      return {
        content: [
          {
            type: "text",
            text: "No connection name specified and no active connection"
          }
        ],
        isError: true
      };
    }
    
    // Find the connection in saved connections
    const connection = savedConnections.find((conn: any) => conn.name === connectionName);
    
    if (!connection) {
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
    
    // Format the memory data
    const memoryData = {
      name: connection.name,
      host: connection.host,
      port: connection.port,
      memory: connection.memory || "No memory stored"
    };
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(memoryData, null, 2)
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving connection memory: ${message}`
        }
      ],
      isError: true
    };
  }
}
