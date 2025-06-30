# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` - Compiles TypeScript to JavaScript, makes scripts executable, and updates version
- `npm run prepare` - Runs build (executed automatically on npm install)
- `npm run watch` - Watches TypeScript files for changes and recompiles

No test suite is configured in this project.

## Architecture Overview

This is an MCP (Model Context Protocol) server that enables LLMs to interact with telnet-based services like MUDs, legacy systems, and network equipment.

### Core Components

**MCP Server Layer** (`src/server.ts`, `src/index.ts`)
- Entry point that initializes the MCP server using the @modelcontextprotocol/sdk
- Registers tools, handles identity management, and manages stdio transport
- Starts both the MCP server and interactive CLI concurrently

**Tool System** (`src/tools/`)
- All MCP tools are registered in `src/tools/index.ts` with schema definitions
- Each tool handler is in separate modules (connect, command, status, etc.)
- Tools include connection management, command sending, session logging, and memory storage

**Connection Management** (`src/connection/`)
- `telnet.ts` - Core telnet client implementation with protocol handling
- `state.ts` - Connection state management and response buffering
- Supports automatic reconnection, keep-alive, and MTTS identification

**Configuration System** (`src/config/`)
- `loader.ts` - Loads configurations and saved connections from `~/.mcp-telnet/`
- `identity.ts` - Manages LLM identity for access control
- `types.ts` - TypeScript types for configuration objects

**CLI Interface** (`src/cli/`)
- Separate interactive CLI that runs on port 9000 for direct telnet management
- Allows manual login and credential entry outside of LLM context

### Key Design Patterns

**Identity-Based Access Control**
- LLM must identify itself using `set_llm_identity` before telnet connections are allowed
- Prevents unauthorized access and provides audit trails

**Response Buffer Management**
- All telnet responses are buffered in connection state
- Buffer can be retrieved without sending commands via `get_buffer`
- Supports continuous mode for conversational interaction

**Session Persistence**
- Connections are saved with names and can be reconnected automatically
- Memory system allows storing notes associated with connections
- Comprehensive session logging with filtering capabilities

**Command Timing**
- Built-in anti-spam protection with configurable delays
- Sequence commands allow precise timing between multiple operations
- Default delays prevent server-side throttling

### Data Storage

All data is stored in `~/.mcp-telnet/`:
- `config.json` - Connection profiles and server settings
- `llm-identity.json` - LLM identity information
- `logs/` - Session logs directory (no rotation implemented)

### Security Considerations

- Credentials should never be provided to LLMs in plain text
- Use CLI interface on port 9000 for manual credential entry
- Plain telnet only (no secure telnet implementation)
- Connection state includes sensitive telnet negotiation data