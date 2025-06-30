import { z } from "zod";
import { connect } from "../connection/index.js";
import { savedConnections } from "../config/index.js";
import { loadSavedConnections, saveSavedConnections } from "../config/loader.js";
import { log } from "../utils/logging.js";

/**
 * Handle the connect_telnet tool
 * Smart connection handler that can:
 * 1. Connect to a saved connection by name
 * 2. Connect to a new server by host/port
 * 3. Save a new connection with a custom name
 * @param args The tool arguments (name, host, port, saveName)
 * @returns Object containing the connection results
 */
export async function handleConnectTool(args: Record<string, unknown>) {
  try {
    // Load saved connections to ensure we have the latest
    loadSavedConnections();
    
    // Parse connection parameters
    const params = z.object({
      name: z.string().optional(),
      host: z.string().optional(),
      port: z.number().default(23).optional(),
      saveName: z.string().optional()
    }).parse(args);
    
    // Check if we're connecting by name to a saved connection
    if (params.name) {
      const savedConnection = savedConnections.find(
        (conn: any) => conn.name.toLowerCase() === params.name!.toLowerCase()
      );
      
      if (!savedConnection) {
        return {
          content: [
            {
              type: "text",
              text: `No saved connection found with name "${params.name}"`
            }
          ],
          isError: true
        };
      }
      
      const result = await connect(savedConnection.host, savedConnection.port, savedConnection.name);
      
      // Update saved connection status if successful
      if (result.success) {
        // Find and update the connection
        const existingIndex = savedConnections.findIndex(
          (conn: any) => conn.name === savedConnection.name
        );
        
        if (existingIndex !== -1) {
          savedConnections[existingIndex].isActive = true;
          const saveSuccess = saveSavedConnections();
          if (!saveSuccess) {
            log(`WARNING: Failed to save connection ${savedConnection.name}`, 'warn');
          }
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: result.message
          }
        ],
        isError: !result.success
      };
    }
    
    // Otherwise, connect by host/port
    if (!params.host) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either a connection name or a host to connect to"
          }
        ],
        isError: true
      };
    }
    
    // Use saveName if provided, otherwise host:port
    const connectionName = params.saveName || `${params.host}:${params.port}`;
    
    const result = await connect(params.host, params.port || 23, connectionName);

    // Add to saved connections if successful
    if (result.success) {
      // Check if connection already exists
      const existingIndex = savedConnections.findIndex(
        (conn: any) => conn.name === connectionName
      );
      
      if (existingIndex !== -1) {
        // Update existing connection
        savedConnections[existingIndex].isActive = true;
      } else {
        // Add new connection
        savedConnections.push({
          name: connectionName,
          host: params.host,
          port: params.port || 23,
          isActive: true
        });
      }
      
      // Persist to disk
      const saveSuccess = saveSavedConnections();
      if (!saveSuccess) {
        log(`WARNING: Failed to save connection ${connectionName}`, 'warn');
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: result.message + (params.saveName ? `\nConnection saved as "${connectionName}"` : "")
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
          text: `Error connecting: ${message}`
        }
      ],
      isError: true
    };
  }
}
