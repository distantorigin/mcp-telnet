import * as path from 'path';
import * as os from 'os';

import { SavedConnection, ServerConfig } from './types.js';

export interface ConnectionConfig {
  name: string;
  host: string;
  port: number;
  loginSequence?: {
    commands: string[];
    expectedResponses?: string[];
    delayBetweenCommands?: number;
  };
}

// Configuration state
export let configurations: ConnectionConfig[] = [];
export let savedConnections: SavedConnection[] = [];

// Create config directory in user's home directory
export const CONFIG_DIR = path.join(os.homedir(), ".mcp-telnet");

// Path to the configuration file
export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// Import constants instead of redefining them
export { DEFAULT_TIMEOUT } from './constants.js';

// Functions to update configurations
export function setConfigurations(newConfigs: ConnectionConfig[]): void {
  configurations = newConfigs;
}

export function setSavedConnections(newConnections: SavedConnection[]): void {
  savedConnections = newConnections;
}
