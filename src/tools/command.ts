import { z } from "zod";
import { sendCommand } from "../connection/index.js";
import { DEFAULT_TIMEOUT, MAX_TIMEOUT } from "../config/constants.js";
import { log } from "../utils/logging.js";

/**
 * Handle the send_command tool
 * Sends a command to the telnet server and waits for a response
 * Supports optional timeout and waiting after the command
 * @param args The tool arguments (command, timeout, waitAfter)
 * @returns Object containing the server response
 */
export async function handleCommandTool(args: Record<string, unknown>) {
  try {
    const command = z.string().parse(args.command);
    const timeout = z.number().min(1000).max(MAX_TIMEOUT).default(DEFAULT_TIMEOUT).parse(args.timeout);
    const waitAfter = z.number().min(0).max(60).default(0).parse(args.waitAfter);
    
    const result = await sendCommand(command, timeout);
    
    // If wait time is specified, wait before returning
    if (waitAfter > 0) {
      log(`Waiting for ${waitAfter} seconds after command...`);
      await new Promise(resolve => setTimeout(resolve, waitAfter * 1000));
      log(`Wait completed (${waitAfter} seconds)`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: waitAfter > 0 ? 
            `${result.response}\n\n[Waited ${waitAfter} seconds after command]` : 
            result.response
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
          text: `Error executing command: ${message}`
        }
      ],
      isError: true
    };
  }
}
