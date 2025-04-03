import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG_DIR } from '../config/index.js';
import { log } from './logging.js';

/**
 * Log directory for session logs
 */
const LOG_DIR = path.join(CONFIG_DIR, 'logs');

/**
 * Ensure log directory exists (will happen on demand when needed)
 */
function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      log(`Created log directory: ${LOG_DIR}`);
    }
  } catch (error) {
    log(`Error creating log directory: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

// Current session tracking variables
let currentSessionId = '';
let currentSessionFile = '';
let currentConnectionName = '';

// Session log event types
export enum SessionEventType {
  CONNECTION = 'CONNECTION',
  DISCONNECTION = 'DISCONNECTION',
  COMMAND = 'COMMAND',
  RESPONSE = 'RESPONSE',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT',
  MODE_CHANGE = 'MODE_CHANGE',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  SYSTEM = 'SYSTEM'
}

// Generate a timestamp in ISO8601 format
function getISOTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Start a new telnet session and initialize logging
 * @param connectionName Name identifier for this connection
 * @param host Remote host address
 * @param port Remote port number
 * @returns A unique session ID for the new session
 */
export function startSession(connectionName: string, host: string, port: number): string {
  ensureLogDir();
  const timestamp = getISOTimestamp();
  currentSessionId = crypto.randomUUID();
  currentConnectionName = connectionName || `${host}-${port}`;
  
  // Create log filename
  const sanitizedName = currentConnectionName.replace(/[^\w\s-]/g, '_');
  currentSessionFile = path.join(LOG_DIR, `${sanitizedName}_${timestamp.replace(/:/g, '-')}.log`);
  
  // Write session start marker
  const metadata = {
    host,
    port,
    connectionName: currentConnectionName,
    timestamp,
    sessionId: currentSessionId
  };
  
  const startMarker = `=== SESSION START: ${timestamp} ===\nSession ID: ${currentSessionId}\nConnection: ${currentConnectionName} (${host}:${port})\n\n`;
  
  fs.writeFileSync(currentSessionFile, startMarker, { flag: 'a' });
  
  return currentSessionId;
}

/**
 * End the current session and write end marker
 */
export function endSession(): void {
  if (!currentSessionId) return;
  
  const timestamp = getISOTimestamp();
  const endMarker = `\n=== SESSION END: ${timestamp} ===\n\n`;
  
  fs.writeFileSync(currentSessionFile, endMarker, { flag: 'a' });
  
  currentSessionId = '';
}

/**
 * Log a new event to the current telnet session
 * @param eventType Type of event (connection, command, etc.)
 * @param details Additional details about the event
 */
export function logSessionEvent(eventType: SessionEventType, details: string): void {
  if (!currentSessionId) return;
  
  try {
    const timestamp = getISOTimestamp();
    
    // Add a separator line before response content to make logs more readable
    let logEntry = `[${timestamp}] [${eventType}]`;
    
    // For events with potentially large content, add a newline after the header
    if (eventType === SessionEventType.RESPONSE || 
        eventType === SessionEventType.COMMAND || 
        eventType === SessionEventType.ERROR || 
        eventType === SessionEventType.TIMEOUT) {
      logEntry += `\n${details}\n`;
      // Add a separator after events with potentially large content
      logEntry += `${'='.repeat(80)}\n`;
    } else {
      // For other events, keep them on one line
      logEntry += ` ${details}\n`;
    }
    
    fs.writeFileSync(currentSessionFile, logEntry, { flag: 'a' });
  } catch (error) {
    log(`Error writing to session log: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

/**
 * Get session logs with filtering options
 * @param connectionName Optional filter by connection name
 * @param startDate Optional filter by start date (ISO format)
 * @param endDate Optional filter by end date (ISO format)
 * @param sessionId Optional filter by specific session ID
 * @returns Session logs matching the specified criteria
 */
export function getSessionLogs(
  connectionName?: string, 
  startDate?: string, 
  endDate?: string, 
  sessionId?: string
): string {
  ensureLogDir();
  // Get list of log files
  const logFiles = fs.readdirSync(LOG_DIR)
    .filter(file => file.endsWith('.log'))
    .sort((a, b) => b.localeCompare(a));  // Sort with newest files first
  
  // Filter by connection name if provided
  const filteredByName = connectionName
    ? logFiles.filter(file => file.startsWith(connectionName.replace(/[^\w\s-]/g, '_')))
    : logFiles;
  
  // Parse dates for filtering
  const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
  const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
  
  // Read and filter log content
  let combinedLogs = '';
  let sessionCount = 0;
  
  for (const file of filteredByName) {
    const filePath = path.join(LOG_DIR, file);
    const stats = fs.statSync(filePath);
    const fileTime = stats.mtime.getTime();
    const fileSizeKB = Math.round(stats.size / 1024);
    
    // Skip if file is outside date range
    if (fileTime < startTimestamp || fileTime > endTimestamp) continue;
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Count sessions in this file
    const sessionMatches = content.match(/=== SESSION START:/g);
    const sessionsInFile = sessionMatches ? sessionMatches.length : 0;
    
    // If sessionId provided, only include sessions that match
    if (sessionId) {
      if (content.includes(`Session ID: ${sessionId}`)) {
        combinedLogs += `\n${'='.repeat(100)}\nFILE: ${file} | Size: ${fileSizeKB}KB | Created: ${new Date(fileTime).toISOString()}\n${'='.repeat(100)}\n${content}`;
        sessionCount++;
      }
    } else {
      combinedLogs += `\n${'='.repeat(100)}\nFILE: ${file} | Size: ${fileSizeKB}KB | Created: ${new Date(fileTime).toISOString()} | Sessions: ${sessionsInFile}\n${'='.repeat(100)}\n${content}`;
      sessionCount += sessionsInFile;
    }
  }
  
  if (!combinedLogs) {
    return 'No session logs found matching the specified criteria.';
  }
  
  const summary = `Found ${sessionCount} sessions across ${filteredByName.length} log files.\n`;
  return summary + combinedLogs;
}

/**
 * Get the current active session ID
 * @returns The current session ID or empty string if no active session
 */
export function getCurrentSessionId(): string {
  return currentSessionId;
}

/**
 * Get the path to the current session log file
 * @returns Path to the current session log file or empty string if no active session
 */
export function getCurrentSessionFile(): string {
  return currentSessionFile;
}
