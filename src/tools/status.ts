import { getConnectionState, getResponseBuffer, setConnectionState } from "../connection/index.js";
import { log } from "../utils/logging.js";
import { logSessionEvent, SessionEventType } from "../utils/sessionLogging.js";
import { z } from "zod";

/**
 * Handle the connection_status tool
 */
export async function handleConnectionStatusTool(args: any = {}) {
  const state = getConnectionState();
  
  // Check if the toggle parameter is present
  if (args.toggleContinuousMode !== undefined) {
    // Toggle or set the mode based on the parameter
    if (typeof args.toggleContinuousMode === 'boolean') {
      setConnectionState({ continuousEngagementActive: args.toggleContinuousMode });
    } else {
      setConnectionState({ continuousEngagementActive: !state.continuousEngagementActive });
    }
    const updatedState = getConnectionState();
    log(`Continuous interaction mode ${updatedState.continuousEngagementActive ? 'enabled' : 'disabled'}`);
    logSessionEvent(
      SessionEventType.MODE_CHANGE,
      `Continuous interaction mode ${updatedState.continuousEngagementActive ? 'enabled' : 'disabled'}`
    );
  }
  
  // Check if defaultDelay parameter is present
  if (args.defaultDelay !== undefined) {
    // Validate and set the default delay
    const defaultDelay = z.number().min(0).max(60).safeParse(args.defaultDelay);
    if (defaultDelay.success) {
      setConnectionState({ defaultDelay: defaultDelay.data });
      log(`Default delay set to ${defaultDelay.data} seconds`);
      logSessionEvent(
        SessionEventType.CONFIG_CHANGE,
        `Default delay set to ${defaultDelay.data} seconds`
      );
    }
  }
  
  // Get the updated state
  const updatedState = getConnectionState();
  
  const status = {
    isConnected: updatedState.isConnected,
    host: updatedState.host,
    port: updatedState.port,
    connectionName: updatedState.name,
    lastError: updatedState.lastError,
    lastCommand: updatedState.lastCommand,
    lastResponsePreview: updatedState.lastResponse.substring(0, 200) + 
      (updatedState.lastResponse.length > 200 ? "..." : ""),
    continuousModeEnabled: updatedState.continuousEngagementActive,
    defaultDelay: updatedState.defaultDelay || 0
  };
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(status, null, 2)
      }
    ]
  };
}

/**
 * Handle the get_buffer tool
 */
export async function handleBufferTool() {
  const state = getConnectionState();
  const buffer = getResponseBuffer();
  
  return {
    content: [
      {
        type: "text",
        text: state.isConnected 
          ? buffer || "No data in buffer" 
          : "Not connected to a telnet server"
      }
    ],
    isError: !state.isConnected
  };
}
