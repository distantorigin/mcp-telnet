import { getSessionLogs } from '../utils/sessionLogging.js';
import { log } from '../utils/logging.js';
import { z } from 'zod';

/**
 * Handle the get_session_logs tool
 */
export async function handleSessionLogsTool(args: Record<string, unknown>) {
  try {
    // Validate and extract parameters
    const params = z.object({
      connectionName: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sessionId: z.string().optional()
    }).parse(args);
    
    log(`Retrieving session logs with params: ${JSON.stringify(params)}`);
    
    // Get logs based on parameters
    const logs = getSessionLogs(
      params.connectionName,
      params.startDate,
      params.endDate,
      params.sessionId
    );
    
    return {
      content: [
        {
          type: "text",
          text: logs || "No session logs found matching the specified criteria."
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving session logs: ${message}`
        }
      ],
      isError: true
    };
  }
}
