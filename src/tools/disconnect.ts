import { disconnect, getConnectionState } from "../connection/index.js";

/**
 * Handle the disconnect_telnet tool
 * Disconnects from the current telnet server
 * @returns Object containing the disconnect result
 */
export async function handleDisconnectTool() {
  const state = getConnectionState();
  
  if (!state.isConnected) {
    return {
      content: [
        {
          type: "text",
          text: "Not connected to a telnet server"
        }
      ],
      isError: true
    };
  }
  
  try {
    const result = await disconnect();
    
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
          text: `Error disconnecting: ${message}`
        }
      ],
      isError: true
    };
  }
}
