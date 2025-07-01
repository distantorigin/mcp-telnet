# MCP-Telnet Tools Reference

MCP-Telnet provides a comprehensive set of tools for interacting with telnet services. This document provides detailed information about each available tool.

## Identity Management

### set_llm_identity

Sets the identity information for the LLM. This identity is used during telnet negotiation to identify the client. This typically happens automatically but can be set manually if needed.

```
set_llm_identity with: {
  "name": "Claude",
  "version": "3.7 Sonnet",
  "provider": "Anthropic",
  "capabilities": ["text"],
  "metadata": { "additional": "info" }
}
```

Parameters:
- `name`: Name of the LLM (required)
- `version`: Version of the LLM (required)
- `provider`: Provider/creator of the LLM (required)
- `capabilities`: Array of capability strings (optional)
- `metadata`: Additional metadata object (optional)

### get_llm_identity

Retrieves the current identity information.

```
get_llm_identity
```

Returns the current identity with name, version, provider, and other details.

## Connection Management

### connect_telnet

Establishes a connection to a telnet server either by specifying host/port or using a saved connection name.

```
connect_telnet with: {
  "host": "mud.example.com",
  "port": 4000,
  "saveName": "my-mud"
}
```

For SSL/TLS encrypted connections:

```
connect_telnet with: {
  "host": "chatmud.com",
  "port": 7443,
  "tls": true,
  "saveName": "ChatMUD-secure"
}
```

Or connect using a saved connection:

```
connect_telnet with: {
  "name": "my-mud"
}
```

Parameters:
- `host`: Hostname or IP address (required for new connections)
- `port`: Port number, defaults to 23 if not specified
- `saveName`: Name to save this connection as (optional)
- `name`: Name of a previously saved connection to use
- `tls`: Enable SSL/TLS encryption for secure connections (optional, defaults to false)

### disconnect_telnet

Closes the current telnet connection.

```
disconnect_telnet
```

### connection_status

Gets or updates the status of the current connection.

```
connection_status with: {
  "toggleContinuousMode": true,
  "defaultDelay": 2
}
```

Parameters:
- `toggleContinuousMode`: Enable or disable continuous mode (optional)
- `defaultDelay`: Set a default delay in seconds between commands (optional)

Returns information about the current connection including host, port, and state.

### list_saved_connections

Lists all saved connections.

```
list_saved_connections
```

Returns an array of saved connections with their details.

## Command Management

### send_command

Sends a command to the telnet server and returns the response.

```
send_command with: {
  "command": "look",
  "timeout": 30000,
  "waitAfter": 3
}
```

Parameters:
- `command`: The command to send (required)
- `timeout`: Timeout in milliseconds (defaults to 30000)
- `waitAfter`: Seconds to wait after sending the command (defaults to 0)

### get_buffer

Gets the current response buffer without sending a command.

```
get_buffer
```

Returns the current buffer content.

### wait

Waits for a specified number of seconds before proceeding.

```
wait with: {
  "seconds": 5
}
```

Parameters:
- `seconds`: Number of seconds to wait (0-60, defaults to 1)

### sequence_commands

Sends a sequence of commands with specified delays between them.

```
sequence_commands with: {
  "commands": [
    { "command": "north", "waitAfter": 2 },
    { "command": "look", "waitAfter": 1 },
    { "command": "get treasure", "waitAfter": 0 }
  ],
  "timeout": 60000
}
```

Parameters:
- `commands`: Array of command objects with the following structure:
  - `command`: The command to send (required)
  - `waitAfter`: Seconds to wait after this command (defaults to 1)
- `timeout`: Default timeout in milliseconds for all commands (defaults to 30000)

## Logging and Memory

### get_session_logs

Retrieves session logs with filtering options.

```
get_session_logs with: {
  "connectionName": "medievia",
  "startDate": "2023-01-01T00:00:00Z",
  "endDate": "2023-01-31T23:59:59Z",
  "sessionId": "a1b2c3d4-e5f6-g7h8-i9j0"
}
```

Parameters:
- `connectionName`: Filter logs by connection name (optional)
- `startDate`: Filter logs by start date in ISO format (optional)
- `endDate`: Filter logs by end date in ISO format (optional)
- `sessionId`: Filter logs by specific session ID (optional)

### update_connection_memory

Stores or updates memory/notes for a connection.

```
update_connection_memory with: {
  "connectionName": "batmud",
  "memory": "Market square is north of the main gate"
}
```

Parameters:
- `connectionName`: Name of the saved connection (uses current if omitted)
- `memory`: Text to save as memory (required)

### get_connection_memory

Retrieves the stored memory for a connection.

```
get_connection_memory with: {
  "connectionName": "batmud"
}
```

Parameters:
- `connectionName`: Name of the saved connection (uses current if omitted)

## Advanced Usage

### Tool Combinations

Tools can be used in sequence for more complex interactions:

1. Connect to a server
2. Send an initial command
3. Get the buffer to check for login prompts
4. Send credentials
5. Wait for server response
6. Send follow-up commands

### Error Handling

All tools provide consistent error messages when issues occur. The most common errors are:

- Connection errors (server unreachable)
- Authentication failures
- Timeout errors (server didn't respond in time)
- Command failures

Always check the success status of tool returns to handle errors appropriately.

### MTTS Protocol Details

The MTTS (Mud Terminal Type Standard) is used during connection negotiation. MCP-Telnet sends:

```
MTTS 1 MCP-Telnet/[VERSION] [CLIENT_NAME]/[CLIENT_VERSION] ([PROVIDER]) 13
```

The flags value (13) indicates:
- UTF-8 text encoding (4)
- ANSI color support (1)
- 256 color support (8)

This helps servers provide appropriate formatting and identify the client properly.
