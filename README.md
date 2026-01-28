<div align="center">

# 🔮 Nyantify

**Let AI do the work. Nyantify will call you when it's done.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange)](https://modelcontextprotocol.io/)

*Smart notification middleware that teaches AI assistants to interrupt politely*

[English](README.md) · [中文](docs/README.zh.md) · [日本語](docs/README.ja.md)

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
Automatically detects current focus application, won't interrupt during deep work.

### 2. Time-Aware
```
Short tasks (<60s) → Silent completion
Long tasks (>60s) → Push to phone
```
Only sends notifications for tasks worth your attention.

### 3. Project-Aware
```
Notification subtitle: mcp-server-nyantify
Instantly know which project the message belongs to
```

### 4. Multi-Language Support
- 🇨🇳 Chinese
- 🇺🇸 English  
- 🇯🇵 Japanese

---

## 🚀 Quick Start

### Prerequisites
- macOS (IDE focus detection relies on AppleScript)
- Node.js 18+
- [Bark iOS App](https://apps.apple.com/app/bark-custom-notifications/id1403753865)

### Installation

```bash
git clone https://github.com/ArtrixTech/mcp-server-nyantify.git
cd mcp-server-nyantify
npm install
npm run build
```

### Configuration

**OpenCode** (`~/.config/opencode/opencode.json`):
```json
{
  "mcp": {
    "nyantify": {
      "type": "local",
      "command": ["node", "/path/to/dist/index.js"],
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
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "BARK_KEY": "your_bark_key_here"
      }
    }
  }
}
```

Restart your AI assistant, and you're all set!

---

## 🎮 How It Works

```
┌─────────────┐    STEP 1    ┌─────────────┐
│  Chat Start  │─────────────▶│ nyantify_start│
└─────────────┘              └─────────────┘
       │                            │
       │                            ▼
       │                    ┌─────────────┐
       │                    │ Start Timer │
       │                    └─────────────┘
       │                            │
       │      User working...       │
       │                            │
       │                            ▼
       │                    ┌─────────────┐
       │                    │ Detect IDE  │
       │                    └─────────────┘
       │                            │
       │    STEP 2    ┌─────────────┐
       │◀─────────────│ nyantify_end │
       │              └─────────────┘
       │                     │
       ▼                     ▼
┌─────────────┐    ┌─────────────┐
│  Chat End    │    │ Duration>60s?│
└─────────────┘    └─────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      User left IDE              User still in IDE
              │                       │
              ▼                       ▼
    ┌─────────────────┐      ┌─────────────────┐
    │ 📱 Push to iPhone │      │ 🔕 Silent finish │
    │ Nyantify·Done     │      │ No interruption │
    └─────────────────┘      └─────────────────┘
```

**Notification Example**:
```
Title: Nyantify · Task Completed · 2min30s
Subtitle: mcp-server-nyantify
Body: Code refactoring complete, please confirm submission
```

---

## 🔧 Configuration Options

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BARK_KEY` | ✅ | - | Bark push key |
| `LANGUAGE` | ❌ | `en` | Language: `zh`/`en`/`ja` |
| `MIN_DURATION_SECONDS` | ❌ | `60` | Minimum duration to trigger notification (seconds) |
| `IDE_BUNDLE_IDS` | ❌ | Built-in list | Custom IDE detection identifiers |

---

## 🛠️ Tech Stack

- **TypeScript** - Type-safe Node.js development
- **MCP Protocol** - Model Context Protocol standard
- **AppleScript** - macOS IDE focus detection
- **Bark** - iOS APNs push service

---

## 📚 Documentation

- [中文文档](docs/README.zh.md) - 简体中文版本
- [日本語ドキュメント](docs/README.ja.md) - 日本語版
- [Architecture](docs/ARCHITECTURE.md) - System design and implementation details
- [Contributing](docs/CONTRIBUTING.md) - How to contribute to this project

---

## 🤝 Contributing

PRs welcome! Please follow:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

---

<div align="center">

**Made with ❤️ for developers who value their focus time**

</div>
