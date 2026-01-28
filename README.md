# 🔔 MCP Server Nyantify

> **Smart iOS notifications for AI coding agents**

[![npm version](https://img.shields.io/npm/v/mcp-server-nyantify.svg)](https://www.npmjs.com/package/mcp-server-nyantify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

An intelligent [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that sends iOS push notifications via [Bark](https://bark.day.app/) only when you need them—during long conversations or when immediate attention is required.

## ✨ Features

- **🎯 Smart Timing** - Only notifies for conversations running longer than 60 seconds (configurable)
- **💻 IDE Aware** - Automatically detects when you're coding and skips notifications
- **🔔 Emergency Alerts** - Direct notification API for urgent situations requiring immediate decisions
- **🚀 Zero Config** - Works out of the box with sensible defaults
- **📝 Simple API** - Just call `start_task` at the beginning and `end_task` at the end of each chat

## 📋 Prerequisites

- **macOS** (required for IDE focus detection via AppleScript)
- **Node.js 18+**
- **[Bark iOS App](https://apps.apple.com/app/bark-custom-notifications/id1403753865)** with a push key

## 🚀 Quick Start

### 1. Get Your Bark Key

1. Install [Bark](https://apps.apple.com/app/bark-custom-notifications/id1403753865) from the App Store
2. Open the app and copy your unique key
3. Keep it handy for configuration

### 2. Install

```bash
# Clone the repository
git clone https://github.com/ArtrixTech/mcp-server-nyantify.git
cd mcp-server-nyantify

# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Configure

Add to your OpenCode or Claude Desktop MCP configuration:

**OpenCode** (`~/.config/opencode/opencode.json`):
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nyantify": {
      "type": "local",
      "command": ["node", "/path/to/mcp-server-nyantify/dist/index.js"],
      "environment": {
        "BARK_KEY": "your_bark_key_here"
      },
      "enabled": true
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "nyantify": {
      "command": "node",
      "args": ["/path/to/mcp-server-nyantify/dist/index.js"],
      "env": {
        "BARK_KEY": "your_bark_key_here"
      }
    }
  }
}
```

### 4. Done! 🎉

Restart your AI assistant and the MCP server will automatically:
- Track conversation duration
- Send notifications only when needed
- Respect your focus time while coding

## 🔧 Configuration Options

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BARK_KEY` | ✅ Yes | - | Your Bark push key from the iOS app |
| `BARK_BASE_URL` | ❌ No | `https://api.day.app` | Bark server URL |
| `MIN_DURATION_SECONDS` | ❌ No | `60` | Minimum duration to trigger notification |
| `IDE_BUNDLE_IDS` | ❌ No | See list below | Custom IDE identifiers to detect |

### Default IDE Detection

The server automatically detects these IDEs:
- **VS Code** - `com.microsoft.VSCode`
- **Cursor** - `com.todesktop.20230321yt3tgw5`
- **IntelliJ IDEA** - `com.jetbrains.intellij`
- **WebStorm** - `com.jetbrains.WebStorm`
- **Xcode** - `com.apple.dt.Xcode`
- **And more...**

## 📖 How It Works

### Automatic Task Tracking

Each conversation is automatically tracked:

1. **Start** → `start_task` is called when the chat begins
2. **Track** → System monitors if you leave your IDE
3. **End** → `end_task` is called when the chat ends
4. **Notify** → If the conversation lasted >60s and you left your IDE, you get a notification

### Direct Notifications

For urgent matters that can't wait:

```javascript
// The AI will ask for your confirmation first
await notify({
  title: "Nyantify",
  body: "Critical: Production database connection failed. Action required.",
  level: "timeSensitive"
});
```

## 🛠️ Available Tools

### `start_task`
Begin tracking a conversation session.

**Parameters:**
- `task_id` (string): Unique identifier for this conversation
- `task_name` (string): Description of what the conversation is about

### `end_task`
End the conversation tracking.

**Parameters:**
- `task_id` (string): Same ID from `start_task`
- `force_notify` (boolean, optional): Override and always send notification

### `notify`
Send an immediate notification (requires user confirmation).

**Parameters:**
- `title` (string): Must be `"Nyantify"`
- `body` (string): Clear, specific message
- `level` (string, optional): `"timeSensitive"` for urgent matters

## 🧪 Testing

See [TEST_GUIDE.md](./TEST_GUIDE.md) for comprehensive testing instructions covering:
- ✅ Direct notifications
- ✅ Short task handling (no notification)
- ✅ Long task + away from IDE (notification sent)
- ✅ Long task + in IDE (no notification)
- ✅ Force notifications
- ✅ Concurrent task handling

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please read [AGENTS.md](./AGENTS.md) for detailed development guidelines.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- [Bark](https://bark.day.app/) - The awesome iOS push notification app
- [Model Context Protocol](https://modelcontextprotocol.io/) - The protocol enabling this integration
- [OpenCode](https://opencode.ai/) - The AI coding agent framework

## 📬 Support

- 🐛 [Bug Reports](https://github.com/ArtrixTech/mcp-server-nyantify/issues)
- 💡 [Feature Requests](https://github.com/ArtrixTech/mcp-server-nyantify/issues)
- 📧 [Discussions](https://github.com/ArtrixTech/mcp-server-nyantify/discussions)

---

Made with ❤️ for developers who don't want to be interrupted while coding
