import fs from 'fs';
import path from 'path';
import { log } from '../utils/logging.js';
import { CONFIG_DIR } from './index.js';

/**
 * Define the data directory based on environment variable or CONFIG_DIR
 * Uses MCP_TELNET_DATA_DIR if set, otherwise uses CONFIG_DIR
 */
const DATA_DIR = process.env.MCP_TELNET_DATA_DIR || CONFIG_DIR;
const IDENTITY_FILE_PATH = path.join(DATA_DIR, 'llm-identity.json');

/**
 * Interface for LLM identity
 */
export interface LLMIdentity {
  name: string;
  version: string;
  provider: string;
  capabilities: string[];
  metadata: Record<string, string>;
}

/**
 * Default identity when none has been set
 * This is replaced when set_llm_identity is called
 */
const DEFAULT_IDENTITY: LLMIdentity = {
  name: 'Unknown',
  version: '0.0.0',
  provider: 'Unknown',
  capabilities: [],
  metadata: {}
};

// Current identity
let currentIdentity: LLMIdentity = { ...DEFAULT_IDENTITY };

/**
 * Initialize the identity system
 */
export function initializeIdentity(): void {
  try {
    // Create the data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      log(`Created data directory: ${DATA_DIR}`);
      }
      
      // Try to load saved identity
      loadIdentity();
} catch (error) {
      log(`Error initializing identity: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

/**
 * Load identity from disk
 */
export function loadIdentity(): void {
  try {
    if (fs.existsSync(IDENTITY_FILE_PATH)) {
      const data = fs.readFileSync(IDENTITY_FILE_PATH, 'utf8');
      const loadedIdentity = JSON.parse(data);
      
      // Validate and use the loaded identity
      currentIdentity = {
        name: loadedIdentity.name || DEFAULT_IDENTITY.name,
        version: loadedIdentity.version || DEFAULT_IDENTITY.version,
        provider: loadedIdentity.provider || DEFAULT_IDENTITY.provider,
        capabilities: Array.isArray(loadedIdentity.capabilities) ? 
          loadedIdentity.capabilities : DEFAULT_IDENTITY.capabilities,
        metadata: typeof loadedIdentity.metadata === 'object' ?
          loadedIdentity.metadata : DEFAULT_IDENTITY.metadata
      };
      
      log(`Loaded LLM identity: ${currentIdentity.name} ${currentIdentity.version}`);
    }
  } catch (error) {
    log(`Error loading identity: ${error instanceof Error ? error.message : String(error)}`, 'error');
    currentIdentity = { ...DEFAULT_IDENTITY };
  }
}

/**
 * Save identity to disk
 */
export function saveIdentity(): void {
  try {
    fs.writeFileSync(
      IDENTITY_FILE_PATH,
      JSON.stringify(currentIdentity, null, 2),
      'utf8'
    );
    log(`Saved LLM identity: ${currentIdentity.name} ${currentIdentity.version}`);
  } catch (error) {
    log(`Error saving identity: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

/**
 * Get the current LLM identity
 */
export function getLLMIdentity(): LLMIdentity {
  return { ...currentIdentity };
}

/**
 * Set the LLM identity
 */
export function setLLMIdentity(identity: Partial<LLMIdentity>): LLMIdentity {
  // Update only provided fields
  currentIdentity = {
    ...currentIdentity,
    ...identity
  };
  
  // Save the updated identity
  saveIdentity();
  
  return { ...currentIdentity };
}

/**
 * Check if LLM has been properly identified
 */
export function isLLMIdentified(): boolean {
  return currentIdentity.name !== 'Unknown' && 
         currentIdentity.version !== '0.0.0' &&
         currentIdentity.provider !== 'Unknown';
}

/**
 * Get the LLM identity as a string for MTTS
 * Used to identify the LLM in telnet negotiations
 * @returns A formatted string with LLM name, version and provider
 */
export function getLLMIdentityString(): string {
  const identity = getLLMIdentity();
  
  if (isLLMIdentified()) {
    return `${identity.name}/${identity.version} (${identity.provider})`;
  } else {
    return "UNKNOWN_LLM (Please use set_llm_identity)";
  }
}
