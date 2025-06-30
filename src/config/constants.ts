// Configuration constants for the telnet MCP server

// Default timeout for telnet operations in milliseconds (30 seconds)
export const DEFAULT_TIMEOUT = 30000;

// Keep-alive interval in milliseconds (15 seconds)
export const KEEP_ALIVE_INTERVAL = 15000;

// Number of reconnection attempts before giving up
export const MAX_RECONNECT_ATTEMPTS = 3;

// Initial delay before attempting to reconnect, in milliseconds
export const RECONNECT_INITIAL_DELAY = 5000;

// Time to wait for response buffer to accumulate, in milliseconds
export const RESPONSE_BUFFER_WAIT = 500;

// Telnet protocol constants
export const TELNET = {
  // Command codes
  CMD: {
    IAC: 255,    // Interpret As Command
    WILL: 251,   // Willing to enable option
    WONT: 252,   // Not willing to enable option
    DO: 253,     // Request to enable option
    DONT: 254,   // Request to disable option
    SB: 250,     // Subnegotiation Begin
    SE: 240,     // Subnegotiation End
  },
  
  // Option codes
  OPT: {
    TERMINAL_TYPE: 24,  // Terminal Type option
  },
  
  // Subnegotiation commands
  SUB: {
    IS: 0,            // IS command in subnegotiation
    SEND: 1,          // SEND command in subnegotiation
  },
  
  // MTTS flags
  MTTS: {
    ANSI: 1,          // Support for ANSI colors
    UTF8: 4,          // Support for UTF-8 encoding
    COLOR_256: 8,     // Support for 256 colors
  }
};

// Default CLI port
export const DEFAULT_CLI_PORT = 9000;
