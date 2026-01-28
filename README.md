# MCP Server Nyantify

An intelligent notification MCP server that sends Bark push notifications only when needed - during long-running tasks or when user attention is required.

## Features

- **Smart Notifications**: Only notifies for tasks running longer than 60 seconds (configurable)
- **IDE Focus Detection**: Skips notifications when you're actively using an IDE
- **Task Tracking**: Simple start/end task APIs for timing operations
- **Direct Notifications**: Immediate notify API for urgent messages

## Prerequisites

- macOS (for IDE focus detection)
- Node.js 18+
- [Bark iOS App](https://apps.apple.com/app/bark-custom-notifications/id1403753865) with a push key

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your Claude Desktop MCP settings (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nyantify": {
      "command": "node",
      "args": ["/path/to/mcp-server-nyantify/dist/index.js"],
      "env": {
        "BARK_KEY": "your_bark_key_here",
        "BARK_BASE_URL": "https://api.day.app",
        "MIN_DURATION_SECONDS": "60",
        "IDE_BUNDLE_IDS": "com.microsoft.VSCode,com.todesktop.20230321yt3tgw5"
      }
    }
  }
}
```

### Environment Variables

- `BARK_KEY` (required): Your Bark push key from the iOS app
- `BARK_BASE_URL` (optional): Bark server URL (default: https://api.day.app)
- `MIN_DURATION_SECONDS` (optional): Minimum task duration to trigger notification (default: 60)
- `IDE_BUNDLE_IDS` (optional): Comma-separated list of IDE bundle IDs to detect

### Default IDE Bundle IDs

- Visual Studio Code: `com.microsoft.VSCode`
- Cursor: `com.todesktop.20230321yt3tgw5`
- IntelliJ IDEA: `com.jetbrains.intellij`
- WebStorm: `com.jetbrains.WebStorm`
- Xcode: `com.apple.dt.Xcode`
- And more...

## Tools

### start_task

Begin tracking a new task.

**Parameters:**
- `task_id` (string, required): Unique task identifier
- `task_name` (string, required): Human-readable task name

### end_task

Complete a tracked task. Sends notification if duration exceeds threshold AND user is not focused on IDE.

**Parameters:**
- `task_id` (string, required): Task identifier from start_task
- `force_notify` (boolean, optional): Force notification regardless of duration

### notify

Send an immediate Bark notification. Use for urgent messages requiring user attention.

**Parameters:**
- `title` (string, required): Notification title
- `body` (string, required): Notification content
- `subtitle` (string, optional): Subtitle text
- `sound` (string, optional): Sound name
- `group` (string, optional): Notification group
- `level` (string, optional): "active" | "timeSensitive" | "passive"
- `url` (string, optional): URL to open on tap

## Usage Example

```javascript
// Start a long-running task
await start_task({
  task_id: "build-123",
  task_name: "Building project"
});

// ... task runs ...

// End the task - will notify if >60s and not in IDE
await end_task({
  task_id: "build-123"
});

// Urgent notification
await notify({
  title: "Action Required",
  body: "Please review the proposed changes",
  level: "timeSensitive"
});
```

## Development

```bash
# Watch mode
npm run watch

# Build
npm run build
```

## License

MIT
