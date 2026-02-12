# Changelog

## 0.5.0 (Current)
- Added `waitFor` parameter to `send_command` for pattern-based response waiting
  - Polls the response buffer for a regex match instead of using fixed delays
  - Returns immediately when the expected output appears, dramatically reducing latency
  - Falls back gracefully on timeout, returning whatever has accumulated
  - Case-insensitive regex matching with full pattern syntax support
- Added `waitFor` support to `sequence_commands` for per-command pattern waits
  - Each command in a sequence can independently use `waitFor` or `waitAfter`
  - Enables multi-step interactions (e.g., buy flows, menu navigation) in a single tool call
- New internal `sendCommandWaitFor()` function in the connection layer

## 0.3.0
- Improved error handling with custom error classes
- Enhanced logging system with configurable log levels
- Centralized configuration system
- Better type safety throughout the codebase
- Fixed type duplications and consolidated interfaces
- Improved login sequence handling for more reliable connections
- Removed debug code and cleaned up unused variables
- Code quality improvements and optimizations

## 0.2.1
- Enhanced session logging to store the full text of commands and responses
- Improved log formatting with better separators for enhanced readability
- Added file size and session count information to log listings
- Modified log retrieval to sort logs with newest first
- Added timestamp information to log file headers

## 0.2.0
- Initial release
