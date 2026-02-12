import { z } from "zod";
import { log } from "../utils/logging.js";
import { sendCommand, sendCommandWaitFor } from "../connection/index.js";
import { DEFAULT_TIMEOUT, WAITFOR_DEFAULT_TIMEOUT, MAX_TIMEOUT } from "../config/constants.js";

/**
 * Handle the wait tool
 */
export async function handleWaitTool(args: Record<string, unknown>) {
  try {
    // Parse seconds with a default of 1
    const seconds = typeof args.seconds === 'number' ? 
      Math.min(Math.max(0, args.seconds), 3600) : 1;
    
    // Log the wait start
    log(`Waiting for ${seconds} seconds...`);
    
    // Perform the actual wait
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    
    // Log completion
    log(`Wait completed (${seconds} seconds)`);
    
    return {
      content: [
        {
          type: "text",
          text: `Waited for ${seconds} seconds.`
        }
      ],
      isError: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing wait: ${message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Handle the sequence_commands tool
 * Now supports per-command `waitFor` patterns. When a command has a `waitFor`
 * pattern, it uses the pattern-matching mode instead of a fixed delay.
 */
export async function handleSequenceCommandsTool(args: Record<string, unknown>) {
  try {
    // Define the command schema with optional waitFor
    const commandSchema = z.object({
      command: z.string(),
      waitAfter: z.number().min(0).max(60).default(1),
      waitFor: z.string().optional()
    });

    // Parse and validate the commands array and timeout
    const commandsArray = z.array(commandSchema).parse(args.commands || []);
    const defaultTimeout = z.number().min(1000).max(MAX_TIMEOUT).default(DEFAULT_TIMEOUT).parse(args.timeout);

    // Execute commands sequentially with delays or pattern waits
    const resultTexts: string[] = [];

    for (let i = 0; i < commandsArray.length; i++) {
      const { command, waitAfter, waitFor } = commandsArray[i];

      log(`Executing command ${i + 1}/${commandsArray.length}: ${command}${waitFor ? ` (waitFor: "${waitFor}")` : ''}`);

      // Use waitFor mode if pattern is provided, otherwise standard mode
      // waitFor commands use shorter timeout (2s) unless explicitly overridden
      if (waitFor) {
        const waitForTimeout = Math.min(defaultTimeout, WAITFOR_DEFAULT_TIMEOUT);
        const result = await sendCommandWaitFor(command, waitFor, waitForTimeout);
        resultTexts.push(result.response);

        const matchStatus = result.matched ? 'matched' : 'NOT matched (timeout)';
        resultTexts.push(`\n[Command ${i + 1}/${commandsArray.length} executed, waitFor "${waitFor}" ${matchStatus}]`);
      } else {
        const result = await sendCommand(command, defaultTimeout);
        resultTexts.push(result.response);
        resultTexts.push(`\n[Command ${i + 1}/${commandsArray.length} executed]`);

        // Wait if specified and not the last command
        if (waitAfter > 0 && i < commandsArray.length - 1) {
          log(`Waiting ${waitAfter} seconds before next command...`);
          resultTexts.push(`\n[Waiting ${waitAfter} seconds before next command...]`);

          await new Promise(resolve => setTimeout(resolve, waitAfter * 1000));

          log(`Wait completed, proceeding to next command`);
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: resultTexts.join("\n")
        }
      ],
      isError: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing command sequence: ${message}`
        }
      ],
      isError: true
    };
  }
}
