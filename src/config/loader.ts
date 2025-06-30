import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  ConnectionConfig, 
  CONFIG_FILE, 
  CONFIG_DIR,
  setConfigurations,
  setSavedConnections,
  configurations,
  savedConnections
} from './index.js';
import { SavedConnection } from './types.js';
import { log } from '../utils/logging.js';

interface Config {
  configurations: ConnectionConfig[];
  connections: SavedConnection[];
}

// Ensure config directory exists
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      log(`Created config directory at ${CONFIG_DIR}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Error creating config directory: ${message}`);
    }
  }
}

// Load both configurations and connections from a single file
export function loadConfigurations(): ConnectionConfig[] {
  ensureConfigDir();
  
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data) as Config;
      
      // Load configurations
      if (Array.isArray(config.configurations)) {
        setConfigurations(config.configurations);
        log(`Loaded ${config.configurations.length} connection configurations`);
      } else {
        setConfigurations([]);
      }
      
      // Load connections
      if (Array.isArray(config.connections)) {
        setSavedConnections(config.connections);
        log(`Loaded ${config.connections.length} saved connections`);
      } else {
        setSavedConnections([]);
      }
      
      return config.configurations || [];
    } else {
      log(`No configuration file found at ${CONFIG_FILE}`);
      
      // Create an empty configuration file
      const emptyConfig: Config = {
        configurations: [],
        connections: []
      };
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(emptyConfig, null, 2), 'utf8');
      log(`Created empty configuration file at ${CONFIG_FILE}`);
      
      setConfigurations([]);
      setSavedConnections([]);
      return [];
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error loading configurations: ${message}`);
    return [];
  }
}

// Alias for loadConfigurations to maintain compatibility
export function loadSavedConnections(): SavedConnection[] {
  loadConfigurations();
  return savedConnections;
}

// Save both configurations and connections to a single file
export function saveSavedConnections(): boolean {
  ensureConfigDir();
  
  try {
    const config: Config = {
      configurations,
      connections: savedConnections
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    log(`Saved ${savedConnections.length} connections and ${configurations.length} configurations to ${CONFIG_FILE}`);
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error saving connections to ${CONFIG_FILE}: ${message}`, 'error');
    return false;
  }
}
