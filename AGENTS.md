# MCP Server Nyantify - Agent Guidelines

## Project Overview

这是一个 MCP (Model Context Protocol) 服务器，提供智能通知功能，通过 Bark 向 iOS 设备发送推送通知。

### 核心功能
1. **IDE 焦点检测**：检测用户是否正在使用 IDE，避免不必要的打扰
2. **任务计时**：追踪任务执行时间，智能决定是否发送通知
3. **Bark 通知**：通过 HTTP API 发送 iOS 推送通知

## 关键使用规范（必读）

### ⚠️ 任务追踪强制要求

**每次执行可能耗时的操作（构建、测试、部署、长时间运行等）时，必须：**

1. **开始前调用 `start_task`**
2. **完成后调用 `end_task`**

**示例流程：**
```
// 1. 开始任务（必须）
nyantify_start_task({
  task_id: "build-001",
  task_name: "构建项目"
})

// 2. 执行实际操作...

// 3. 结束任务（必须）
nyantify_end_task({
  task_id: "build-001"
})
```

**为什么必须这样做：**
- 让用户知道任务正在进行中
- 任务完成时智能通知（长任务且不在 IDE 时）
- 避免用户以为操作卡住或失败

### ⚠️ 用户确认流程

**在调用 `notify` 发送需要用户决策的通知前，必须先提醒用户：**

**正确做法：**
1. 先告知用户："我需要发送一条通知，请确认..."
2. 等待用户确认或提供信息
3. 然后调用 `notify`

**错误做法：**
- ❌ 直接调用 `notify` 而不提前告知
- ❌ 发送模糊的通知内容

**示例：**
```
// ✅ 正确
"我发现了代码中的潜在问题，需要您确认是否重构。\n"
"我现在发送通知到您的手机，请注意查看。"

nyantify_notify({
  title: "Nyantify",
  body: "代码审查：发现 3 个潜在的性能问题，需要确认是否优化",
  level: "timeSensitive"
})

// ❌ 错误
nyantify_notify({
  title: "Nyantify", 
  body: "有问题",
  level: "timeSensitive"
})
```

## Architecture

```
src/
├── index.ts           # MCP 服务器入口，工具注册
├── bark-client.ts     # Bark HTTP 客户端
├── ide-detector.ts    # macOS IDE 焦点检测 (AppleScript)
└── task-tracker.ts    # 任务计时管理
```

## Code Standards

### TypeScript
- 使用严格模式 (`strict: true`)
- 所有函数必须有明确的返回类型
- 使用 ES2022 和 Node16 模块系统
- 优先使用 `const` 和 `let`，避免 `var`

### Error Handling
- 所有异步操作必须有 try-catch
- 错误信息必须清晰明确
- 使用 `console.error` 记录错误

### Naming Conventions
- 类名：PascalCase (e.g., `BarkClient`)
- 方法/变量：camelCase (e.g., `sendNotification`)
- 常量：UPPER_SNAKE_CASE (e.g., `DEFAULT_IDE_BUNDLE_IDS`)
- 接口：PascalCase 加前缀 I (可选，如 `ITaskConfig`)

## MCP Tools

### 1. start_task
启动任务计时器。

**使用场景**：
- 开始可能耗时较长的操作（构建、测试、部署等）
- **必须调用**：任何预计超过 10 秒的操作

**参数**：
- `task_id`: 唯一标识符（建议使用操作类型+时间戳）
- `task_name`: 可读的任务名称

**示例**：
```json
{
  "task_id": "test-2024-01-28-001",
  "task_name": "运行单元测试"
}
```

### 2. end_task
结束任务，智能判断是否发送通知。

**使用场景**：
- 任务完成后必须调用
- 与 `start_task` 配对使用

**通知触发条件**：
- 任务时长 > 60 秒（可配置）
- 用户当前不在 IDE 中
- 或 `force_notify` 为 true

**参数**：
- `task_id`: 任务 ID（与 start_task 对应）
- `force_notify`: 强制通知（可选，默认 false）

**示例**：
```json
{
  "task_id": "test-2024-01-28-001",
  "force_notify": false
}
```

### 3. notify
直接发送通知，用于紧急情况或需要用户决策。

**使用规范**：
- ⚠️ **必须先提醒用户**："我现在发送通知到您的手机..."
- 标题必须固定为 `"Nyantify"`
- 内容必须明确、具体，说明需要用户做什么
- 只在真正需要时使用

**参数**：
- `title`: "Nyantify"
- `body`: 通知内容（明确说明需要用户决策的内容）
- `level`: "timeSensitive"（推荐，可在专注模式显示）

**正确示例**：
```json
{
  "title": "Nyantify",
  "body": "代码审查需要确认：是否在 UserService 中添加 Redis 缓存？当前查询耗时 2.3s",
  "level": "timeSensitive"
}
```

**错误示例**：
```json
{
  "title": "Nyantify",
  "body": "看一下",
  "level": "timeSensitive"
}
```

## Bark API

### URL 格式
```
https://api.day.app/{key}/{title}/{body}?param=value
```

### 支持的参数
- `sound`: 自定义声音
- `group`: 通知分组
- `level`: active | timeSensitive | passive
- `url`: 点击跳转链接
- `icon`: 自定义图标

## IDE Detection

### 默认检测的 IDE Bundle IDs
- VS Code: `com.microsoft.VSCode`
- Cursor: `com.todesktop.20230321yt3tgw5`
- IntelliJ IDEA: `com.jetbrains.intellij`
- WebStorm: `com.jetbrains.WebStorm`
- Xcode: `com.apple.dt.Xcode`
- 等等...

### 检测原理
使用 AppleScript 获取当前前台应用的 Bundle ID：
```applescript
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set bundleID to bundle identifier of frontApp
end tell
```

## Configuration

### 环境变量
- `BARK_KEY` (必需): Bark 推送密钥
- `BARK_BASE_URL` (可选): Bark 服务器地址
- `MIN_DURATION_SECONDS` (可选): 最小通知时长阈值
- `IDE_BUNDLE_IDS` (可选): 自定义 IDE Bundle ID 列表

### OpenCode 配置示例
```json
{
  "mcp": {
    "nyantify": {
      "type": "local",
      "command": ["node", "/path/to/dist/index.js"],
      "environment": {
        "BARK_KEY": "your_key_here"
      }
    }
  }
}
```

## Testing

### 运行测试
```bash
# 完整测试流程（见 TEST_GUIDE.md）
# 测试包括：
# 1. 直接通知功能
# 2. 短任务不通知
# 3. 长任务 + 离开 IDE 时通知
# 4. 长任务 + 在 IDE 时不通知
# 5. 强制通知
# 6. 并发任务
```

### 测试要求
- 必须在 macOS 上测试（IDE 检测依赖 AppleScript）
- 需要安装 Bark iOS App
- 需要有效的 Bark Key

## Git Workflow

### Commit 格式
使用 Conventional Commits：
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type 说明
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具链

### 示例
```
feat(bark): add support for custom icons

fix(ide-detector): handle case when System Events is not available

docs(readme): add configuration examples
```

## Development

### 本地开发
```bash
# 安装依赖
npm install

# 开发模式（自动编译）
npm run watch

# 构建
npm run build

# 测试 MCP 服务器
BARK_KEY=xxx node dist/index.js
```

### 发布流程
1. 更新版本号 (`package.json`)
2. 运行完整测试
3. 创建 git tag
4. 推送代码和 tag

## Common Issues

### 通知收不到
- 检查 Bark Key 是否正确
- 确认 Bark App 已安装并开启推送
- 检查网络连接

### IDE 检测失败
- 确保在 macOS 上运行
- 检查 AppleScript 权限（系统设置 → 隐私与安全 → 自动化）

### 任务计时错误
- 检查系统时间
- 确保任务 ID 唯一
