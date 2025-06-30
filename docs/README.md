# MCP-Telnet

A bridge connecting LLMs to telnet services.

## What is MCP-Telnet?

MCP-Telnet is an [MCP](https://modelcontextprotocol.io/) server that enables interaction with telnet-based services. It handles the complex details of telnet communication, allowing seamless integration with:

- MUDs (Multi-User Dungeons) for text adventure gaming
- Legacy systems and network equipment management
- Mail servers and other text-based interfaces
- Historical network protocols and systems
- Automated routine tasks on network-accessible devices

## Key Features

MCP-Telnet provides numerous capabilities to make telnet access seamless:

- Mostly complete telnet protocol implementation with MTTS identification
- Reliable connections with automatic reconnection and state persistence
- Flexible command timing with adjustable delays
- Connection-specific memory system for storing notes
- Comprehensive session logging with filtering
- Interactive CLI available via telnet (port 9000)
- Automatic keep-alive packets to maintain connections
- Extensive configuration options for customization

## Installation & Quick Start

The easiest way to use MCP-Telnet is with Claude Desktop. Add this to your `claude-desktop-config.json`:

```json
{
  "mcpServers": {
    "telnet": {
      "command": "npx",
      "args": ["-y", "github:distantorigin/mcp-telnet"]
    }
  }
}
```

No separate installation is needed - Claude Desktop will automatically run it as required.

### Basic Usage

1. Ask Claude to connect to a telnet service:
   ```
   Connect to mud.example.com port 4000 and help me explore as a guest
   ```

2. Send commands naturally:
   ```
   Look at the current room and summarize some of the objects that might be of interest.
   ```

3. Use more advanced features:
   ```
   Please store a note that "The magic shop is west of the town square" in the connection memory
   ```

For detailed usage examples, see [EXAMPLE_PROMPTS.md](./EXAMPLE_PROMPTS.md).

## Tools Overview

MCP-Telnet provides various tools to manage telnet connections. Here are the most commonly used:

- **Connection Management**:
  ```
  connect_telnet with: { "host": "mud.example.com", "port": 4000 }
  ```

- **Command Sending**:
  ```
  send_command with: { "command": "look", "waitAfter": 2 }
  ```

- **Command Sequences**:
  ```
  sequence_commands with: {
    "commands": [
      { "command": "north", "waitAfter": 1 },
      { "command": "look", "waitAfter": 0 }
    ]
  }
  ```

For a complete list of available tools and their options, see [TOOLS.md](./TOOLS.md).

## Command Timing and Anti-Spam

MUDs and telnet servers often need time to process commands. Proper timing also helps avoid triggering anti-spam measures that many servers implement to prevent command flooding, and ensure that the LLM doesn't inundate other users.

MCP-Telnet provides several ways to handle timing:

1. Command with Wait: Add delays after specific commands
2. Command Sequences: Define precise timing between multiple commands
3. Default Delays: Set standard delays for all commands
4. Manual Waits: Insert explicit pauses between operations

This flexibility ensures smooth interactions while preventing issues like:
- Server-side command throttling
- Automatic disconnection for spamming
- Anti-bot measures that detect unnaturally rapid inputs
- Server performance degradation from too many rapid commands

Many MUDs and other services have built-in protection against rapid command sequences, so proper timing is essential for maintaining reliable connections.

## Continuous Mode

Continuous mode is a special interaction feature designed to maintain contextual awareness during ongoing sessions. When enabled, MCP-Telnet adds a prompt at the end of each server response indicating it's ready for the next command.

To enable continuous mode:
```
connection_status with: { "toggleContinuousMode": true }
```

What continuous mode provides:
- Simulates an ongoing conversation with the telnet service
- Maintains context between commands for a more natural flow
- Signals clearly when the server has finished responding
- Makes interaction more intuitive by showing when input is expected

While not a true persistent connection (telnet responses are still discrete), continuous mode bridges the gap between command-by-command interaction and the flowing experience of direct telnet use. This is particularly valuable for MUD gaming, interactive fiction, and extended troubleshooting sessions.

You can disable continuous mode at any time:
```
connection_status with: { "toggleContinuousMode": false }
```

## Configuration

MCP-Telnet stores its configuration in the user's home directory:

- `~/.mcp-telnet/config.json` - Connection profiles and server settings
- `~/.mcp-telnet/llm-identity.json` - Identity information
- `~/.mcp-telnet/logs/` - Session logs directory

Environment variables can override default settings:
- `MCP_TELNET_DATA_DIR` - Alternative data directory location
- `CLI_PORT` - Alternative CLI port (default 9000)
- `NODE_ENV` - Production settings when set to "production"

## Things to be aware of

- Login sequences use exact text matching and may time out with unexpected server responses
- Session logs can grow large with regular use (there is no log rotation implemented)
- ANSI control codes may appear in text output
- **DO NOT** ever provide credentials to an LLM in plain text, with the exception of local AI that you control. If you must provide credentials, use the telnet server on port 9000 to log yourself in once Claude has initiated the connection, entering them yourself out of band.
- Plain telnet protocol only, no secure telnet yet

## Contributing

MCP-Telnet was designed as a prototype and I have very little use for it in my day-to-day. As such, this is a side project, and is primarily AIGC. Thus, maintenance may be erratic and, depending on my current mood towards the ethical quandaries of generative AI, may be taken down at any time. I will make an effort to respond to and address all issues and pull requests, but there are no guarantees.