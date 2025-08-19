import { z } from "zod";
import { getLLMIdentity, setLLMIdentity, isLLMIdentified } from "../config/identity.js";
import { log } from "../utils/logging.js";

/**
 * Handle the set_llm_identity tool
 */
export async function handleSetLLMIdentityTool(args: Record<string, unknown>) {
  try {
    // Parse and validate the identity data
    const name = z.string().optional().parse(args.name);
    const version = z.string().optional().parse(args.version);
    const provider = z.string().optional().parse(args.provider);
    const capabilities = z.array(z.string()).optional().parse(args.capabilities);
    const metadata = z.record(z.string(), z.string()).optional().parse(args.metadata);
    
    // Create the partial identity object
    const partialIdentity: any = {};
    if (name !== undefined) partialIdentity.name = name;
    if (version !== undefined) partialIdentity.version = version;
    if (provider !== undefined) partialIdentity.provider = provider;
    if (capabilities !== undefined) partialIdentity.capabilities = capabilities;
    if (metadata !== undefined) partialIdentity.metadata = metadata;
    
    // Update the identity
    const updatedIdentity = setLLMIdentity(partialIdentity);
    
    log(`Updated LLM identity: ${updatedIdentity.name}/${updatedIdentity.version} (${updatedIdentity.provider})`);
    
    return {
      content: [
        {
          type: "text",
          text: `LLM identity updated successfully:
Name: ${updatedIdentity.name}
Version: ${updatedIdentity.version}
Provider: ${updatedIdentity.provider}
Capabilities: ${updatedIdentity.capabilities.join(", ") || "None"}
Metadata: ${JSON.stringify(updatedIdentity.metadata, null, 2)}`
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
          text: `Error updating LLM identity: ${message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Handle the get_llm_identity tool
 */
export async function handleGetLLMIdentityTool() {
  try {
    // Get the current identity
    const identity = getLLMIdentity();
    const identified = isLLMIdentified();
    
    let statusMessage = "";
    if (!identified) {
      statusMessage = `
WARNING: LLM identity is not fully set. Please use set_llm_identity to properly identify yourself:
Example:
  set_llm_identity with:
  {
    "name": "Claude",
    "version": "3.7 Sonnet", 
    "provider": "Anthropic"
  }`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Current LLM identity:
Name: ${identity.name}
Version: ${identity.version}
Provider: ${identity.provider}
Capabilities: ${identity.capabilities.join(", ") || "None"}
Metadata: ${JSON.stringify(identity.metadata, null, 2)}${statusMessage}`
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
          text: `Error getting LLM identity: ${message}`
        }
      ],
      isError: true
    };
  }
}
