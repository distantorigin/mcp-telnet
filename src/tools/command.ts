import { z } from "zod";
import { sendCommand, sendCommandWaitFor } from "../connection/index.js";
import { DEFAULT_TIMEOUT, WAITFOR_DEFAULT_TIMEOUT, MAX_TIMEOUT } from "../config/constants.js";
import { log } from "../utils/logging.js";

/**
 * Handle the send_command tool
 * Sends a command to the telnet server and waits for a response.
 *
 * Supports two modes:
 * 1. Default mode: Sends command and returns after a fixed buffer wait (500ms).
 *    Use `waitAfter` to add additional delay if the server is slow.
 * 2. waitFor mode: Sends command and polls the response buffer until a regex
 *    pattern is matched, then returns immediately. Much faster than blind waits
 *    because it resolves as soon as the expected output appears.
 *    Default timeout is 2 seconds (not 30s) since patterns should match quickly.
 *
 * @param args The tool arguments (command, timeout, waitAfter, waitFor)
 * @returns Object containing the server response
 */
export async function handleCommandTool(args: Record<string, unknown>) {
  try {
    const command = z.string().parse(args.command);
    const waitAfter = z.number().min(0).max(60).default(0).parse(args.waitAfter);
    const waitFor = args.waitFor != null ? z.string().parse(args.waitFor) : undefined;

    // Use shorter default timeout for waitFor mode (2s vs 30s)
    const timeoutDefault = waitFor ? WAITFOR_DEFAULT_TIMEOUT : DEFAULT_TIMEOUT;
    const timeout = z.number().min(1000).max(MAX_TIMEOUT).default(timeoutDefault).parse(args.timeout);

    // If waitFor pattern is provided, use the pattern-matching mode
    if (waitFor) {
      log(`Using waitFor mode with pattern: "${waitFor}" (timeout: ${timeout}ms)`);
      const result = await sendCommandWaitFor(command, waitFor, timeout);

      let responseText = result.response;

      // Append match status metadata
      if (result.matched) {
        responseText += `\n\n[waitFor pattern "${waitFor}" matched]`;
      } else {
        responseText += `\n\n[waitFor pattern "${waitFor}" was NOT matched before timeout]`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ],
        isError: !result.success
      };
    }

    // Default mode: fixed buffer wait
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
