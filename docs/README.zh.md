# 🔮 Nyantify

**干活交给AI，干完了Nyantify来叫你。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange)](https://modelcontextprotocol.io/)

*智能通知中间件，让AI学会礼貌地打扰你*

[English](../README.md) · [中文](README.zh.md) · [日本語](README.ja.md)

---

## 🎯 解决什么问题

当你让AI助手执行长时间任务时（代码重构、测试运行、构建部署），常常遇到这些困境：

- ❌ **盯着屏幕干等** - 不知道AI什么时候做完
- ❌ **切换去做别的** - 忘记回来看结果，任务烂尾
- ❌ **频繁检查进度** - 打断自己的工作流
- ❌ **被无关通知轰炸** - 在IDE里专注编码时也收到提醒

**Nyantify = AI干活的"门铃系统"**

只有在你**真正需要知道**的时候，才会轻轻推你一下。

---

## ✨ 核心特性

### 1. 智能免打扰
```
你在IDE里写代码 → 完全静默
你离开IDE刷手机 → gentle reminder
```
自动检测当前焦点应用，专注时不打扰。

### 2. 时间感知
```
短任务 (<60秒) → 静默完成
长任务 (>60秒) → 推送到手机
```
只有值得通知的任务才会推送到你的iPhone。

### 3. 项目感知
```
通知副标题: mcp-server-nyantify
一目了然知道是哪个项目的消息
```

### 4. 多语言支持
- 🇨🇳 中文
- 🇺🇸 English  
- 🇯🇵 日本語

---

## 🚀 快速开始

### 前置条件
- macOS (IDE焦点检测依赖AppleScript)
- Node.js 18+
- [Bark iOS App](https://apps.apple.com/app/bark-custom-notifications/id1403753865)

### 安装

```bash
git clone https://github.com/ArtrixTech/mcp-server-nyantify.git
cd mcp-server-nyantify
npm install
npm run build
```

### 配置

**OpenCode** (`~/.config/opencode/opencode.json`):
```json
{
  "mcp": {
    "nyantify": {
      "type": "local",
      "command": ["node", "/path/to/dist/index.js"],
      "environment": {
        "BARK_KEY": "your_bark_key_here",
        "LANGUAGE": "zh"
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

重启AI助手，完成！

---

## 🎮 工作原理

```
┌─────────────┐    STEP 1    ┌─────────────┐
│  对话开始    │─────────────▶│ nyantify_start│
└─────────────┘              └─────────────┘
       │                            │
       │                            ▼
       │                    ┌─────────────┐
       │                    │  开始计时    │
       │                    └─────────────┘
       │                            │
       │         用户工作...        │
       │                            │
       │                            ▼
       │                    ┌─────────────┐
       │                    │ 检测IDE焦点 │
       │                    └─────────────┘
       │                            │
       │    STEP 2    ┌─────────────┐
       │◀─────────────│ nyantify_end │
       │              └─────────────┘
       │                     │
       ▼                     ▼
┌─────────────┐    ┌─────────────┐
│  对话结束    │    │  时长>60s?  │
└─────────────┘    └─────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      用户离开IDE                用户仍在IDE
              │                       │
              ▼                       ▼
    ┌─────────────────┐      ┌─────────────────┐
    │ 📱 推送通知到手机  │      │ 🔕 静默完成      │
    │ Nyantify·任务完成 │      │ 不打扰专注工作   │
    └─────────────────┘      └─────────────────┘
```

**通知示例**:
```
标题: Nyantify · 任务完成 · 2min30s
副标题: mcp-server-nyantify
内容: 代码重构完成，请确认是否提交
```

---

## 🔧 配置选项

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `BARK_KEY` | ✅ | - | Bark推送密钥 |
| `LANGUAGE` | ❌ | `en` | 通知语言: `zh`/`en`/`ja` |
| `MIN_DURATION_SECONDS` | ❌ | `60` | 触发通知的最小时长(秒) |
| `IDE_BUNDLE_IDS` | ❌ | 内置列表 | 自定义IDE检测标识 |

---

## 🛠️ 技术栈

- **TypeScript** - 类型安全的Node.js开发
- **MCP Protocol** - Model Context Protocol标准
- **AppleScript** - macOS IDE焦点检测
- **Bark** - iOS APNs推送服务

---

## 🤝 贡献

欢迎PR！请遵循:
1. Fork仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE)

---

<div align="center">

**Made with ❤️ for developers who value their focus time**

</div>
