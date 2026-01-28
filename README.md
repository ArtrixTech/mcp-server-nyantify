<div align="center">

# 🔮 Nyantify

**Let AI do the work. Nyantify will call you when it's done.**

[![npm version](https://img.shields.io/npm/v/mcp-server-nyantify.svg)](https://www.npmjs.com/package/mcp-server-nyantify)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange)](https://modelcontextprotocol.io/)

*Smart notification middleware that teaches AI assistants to interrupt politely*

[English](README.md) · [中文](docs/README.zh.md)

</div>

---

## 🎯 What Problem Does It Solve?

When you ask your AI assistant to perform long-running tasks (code refactoring, test execution, build deployment), you often face these dilemmas:

- ❌ **Staring at the screen waiting** - Don't know when AI will finish
- ❌ **Switching to do something else** - Forget to check back, task abandoned
- ❌ **Frequently checking progress** - Disrupts your own workflow
- ❌ **Bombarded with irrelevant notifications** - Get reminders even when focused on coding

**Nyantify = The "doorbell system" for AI work**

Only nudges you when you **truly need to know**.

---

## ✨ Core Features

### 1. Smart Do Not Disturb
```
You're coding in IDE → Complete silence
You leave IDE to check phone → Gentle reminder
```

### 2. Time-Aware
```
Short tasks (<60s) → Silent completion
Long tasks (>60s) → Push to phone
```

### 3. Project-Aware
Shows your current folder name so you know which project the notification belongs to.

### 4. Multi-Language Support 🇺🇳
`en` `zh` `ja` `de` `fr` `es` `ru` `ko` `pt` `it` `ar` `hi` `vi` `th`

---

## 🚀 Quick Start

### Prerequisites

- **macOS** (IDE focus detection requires AppleScript)
- **Node.js 18+**
- **[Bark iOS App](https://github.com/Finb/Bark)** - Free open-source push notification app

#### What is Bark?

[Bark](https://github.com/Finb/Bark) is an open-source iOS push notification tool that lets you send custom notifications to your iPhone via simple HTTP requests.

- ✅ **Free & Open Source** - MIT licensed, full source code on [GitHub](https://github.com/Finb/Bark)
- ✅ **Privacy First** - Uses Apple Push Notification Service (APNs), no battery drain
- ✅ **Advanced Features** - Time-sensitive notifications, custom sounds, groups, encryption
- ✅ **Self-Hostable** - Run your own Bark server if needed

**Download**: [App Store](https://apps.apple.com/app/bark-custom-notifications/id1403753865) | [GitHub](https://github.com/Finb/Bark)

### 1. Get Your Bark Key

1. Install [Bark](https://apps.apple.com/app/bark-custom-notifications/id1403753865) on your iPhone
2. Open the app and copy your unique key
3. You'll use this key in the MCP configuration

### 2. Configure Your AI Assistant

**OpenCode** (`~/.config/opencode/opencode.json`):
```json
{
  "mcp": {
    "nyantify": {
      "type": "local",
      "command": ["npx", "-y", "mcp-server-nyantify"],
      "environment": {
        "BARK_KEY": "your_bark_key_here",
        "LANGUAGE": "en"
      }
    }
  }
}
```

**Claude Desktop**:
```json
{
  "mcpServers": {
    "nyantify": {
      "command": "npx",
      "args": ["-y", "mcp-server-nyantify"],
      "env": {
        "BARK_KEY": "your_bark_key_here"
      }
    }
  }
}
```

That's it! No installation needed - `npx` will download and run it automatically.

### 3. Restart and Done

Restart your AI assistant. Nyantify will now track all conversations and notify you when long tasks complete.

---

## 🎮 How It Works

Every conversation automatically follows this flow:

```
Chat Starts
    ↓
[nyantify_start] → Timer starts
    ↓
AI works while you do other things
    ↓
[nyantify_end] → Check duration & IDE focus
    ↓
    ├─ Duration > 60s & Left IDE → 📱 Notify
    └─ Otherwise → 🔕 Silent
```

**Notification Example**:
```
Title: Nyantify · Task Completed · 2min30s
Subtitle: my-awesome-project
Body: Refactoring authentication module
```

---

## 🔧 Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BARK_KEY` | ✅ | - | Your Bark push key |
| `LANGUAGE` | ❌ | `en` | Notification language (see supported languages above) |
| `MIN_DURATION_SECONDS` | ❌ | `60` | Minimum duration to trigger notification |
| `IDE_BUNDLE_IDS` | ❌ | Auto-detect | Custom IDE identifiers |

---

## 🛠️ For Developers

### Local Development

```bash
git clone https://github.com/ArtrixTech/mcp-server-nyantify.git
cd mcp-server-nyantify
npm install
npm run build
npm run start
```

### Publishing to NPM

1. **Login to NPM**:
   ```bash
   npm login
   ```

2. **Update version** (following semver):
   ```bash
   npm version patch  # or minor/major
   ```

3. **Publish**:
   ```bash
   npm publish
   ```

4. **Verify**:
   ```bash
   npm view mcp-server-nyantify
   ```

See [PUBLISHING.md](docs/PUBLISHING.md) for detailed release workflow.

---

## 📚 Documentation

- [中文文档](docs/README.zh.md) - 简体中文版本
- [Architecture](docs/ARCHITECTURE.md) - System design details
- [Contributing](docs/CONTRIBUTING.md) - How to contribute

---

## 🤝 Contributing

PRs welcome! See [Contributing Guide](docs/CONTRIBUTING.md).

---

## 🙏 Acknowledgments

- [Bark](https://github.com/Finb/Bark) - The fantastic open-source iOS notification app
- [Model Context Protocol](https://modelcontextprotocol.io/) - Making AI tools interoperable

---

## 📄 License

MIT License © 2024 [Artrix](https://github.com/ArtrixTech)

---

<div align="center">

**Made with ❤️ for developers who value their focus time**

</div>
