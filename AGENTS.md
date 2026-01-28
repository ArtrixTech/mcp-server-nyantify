# MCP Server Nyantify - Agent Guidelines

## ⚠️ CRITICAL: Mandatory Tool Usage

**You MUST use the `track` tool at the start AND end of EVERY conversation.**

### Why This Is Required

Nyantify tracks conversation duration and sends iPhone notifications when:
- Conversation lasts >60 seconds
- User has left their IDE

**If you skip this tool:**
- User won't know when AI tasks complete
- User may abandon tasks or waste time waiting
- The notification system won't work

---

## Required Workflow

### Step 1: Start Tracking (MANDATORY)

**Call IMMEDIATELY at the beginning of EVERY conversation:**

```javascript
track({
  action: "start",
  task_id: "chat-YYYYMMDD-NNN",
  task_name: "Brief description of this conversation"
})
```

**Examples:**
```javascript
track({
  action: "start",
  task_id: "chat-2024-01-28-001",
  task_name: "Refactoring authentication module"
})
```

### Step 2: Do Your Work

Proceed with the conversation normally.

### Step 3: End Tracking (MANDATORY)

**Call at the END of EVERY conversation:**

```javascript
track({
  action: "end",
  task_id: "chat-YYYYMMDD-NNN"
})
```

**Examples:**
```javascript
track({
  action: "end",
  task_id: "chat-2024-01-28-001"
})
```

---

## Emergency Notifications

### When to Use `direct_notify`

Use `direct_notify` ONLY for urgent situations:

- Production incidents requiring immediate action
- Security vulnerabilities detected
- Critical errors that need user decision
- Time-sensitive alerts

### Required Steps Before Calling

**You MUST warn the user FIRST:**

```
"I need to send a notification to your phone about [specific reason]."
```

### Usage

```javascript
direct_notify({
  title: "Nyantify",
  body: "Production database connection failed. Immediate action required.",
  level: "timeSensitive"
})
```

### Rules

- ✅ **DO**: Use for urgent, actionable alerts
- ✅ **DO**: Explain clearly what action is needed
- ✅ **DO**: Set `level: "timeSensitive"` for urgent matters
- ❌ **DON'T**: Use for routine status updates
- ❌ **DON'T**: Use vague messages like "Done" or "Check this"
- ❌ **DON'T**: Use when `track` would suffice

---

## Tool Reference

### `track`

**Purpose:** Track conversation duration for smart notifications

**When to Call:**
- `action: "start"` - At the very beginning of every conversation
- `action: "end"` - At the very end of every conversation

**Parameters:**
- `action` (string, required): `"start"` or `"end"`
- `task_id` (string, required): Unique ID, e.g., `"chat-2024-01-28-001"`
- `task_name` (string, required for start): Brief description

**Complete Example:**
```javascript
// Start
track({
  action: "start",
  task_id: "chat-2024-01-28-001",
  task_name: "Code review for PR #123"
})

// ... conversation happens ...

// End
track({
  action: "end",
  task_id: "chat-2024-01-28-001"
})
```

### `direct_notify`

**Purpose:** Send immediate urgent notification to user's iPhone

**When to Call:** Only for emergencies and urgent decisions

**Parameters:**
- `title` (string, required): Must be `"Nyantify"`
- `body` (string, required): Clear, specific message
- `level` (string, optional): `"timeSensitive"` (default), `"active"`, or `"passive"`

**Example:**
```javascript
direct_notify({
  title: "Nyantify",
  body: "Security alert: Critical vulnerability found in dependency. Need decision on upgrade.",
  level: "timeSensitive"
})
```

---

## Quick Reference Card

### Every Conversation Template

```
[START]
↓
track({action: "start", task_id: "chat-001", task_name: "description"})
↓
[DO WORK]
↓
track({action: "end", task_id: "chat-001"})
↓
[DONE]
```

### Decision Tree

**Do I need to send a notification right now?**
- Yes, it's urgent → Use `direct_notify`
- No, just track the task → Use `track`

---

## Configuration

### Environment Variables

- `BARK_KEY` (required): Your Bark iOS app key
- `LANGUAGE` (optional): Notification language (`en`, `zh`, `ja`, etc.)
- `MIN_DURATION_SECONDS` (optional): Threshold for notifications (default: 60)

### Example MCP Configuration

```json
{
  "mcp": {
    "nyantify": {
      "type": "local",
      "command": ["npx", "-y", "mcp-server-nyantify"],
      "environment": {
        "BARK_KEY": "your_key_here",
        "LANGUAGE": "en"
      }
    }
  }
}
```

---

## Best Practices

### DO

- ✅ Call `track({action: "start"})` before any other action
- ✅ Call `track({action: "end"})` as your final action
- ✅ Use descriptive `task_name` values
- ✅ Use consistent `task_id` format (chat-YYYYMMDD-NNN)
- ✅ Warn user before using `direct_notify`

### DON'T

- ❌ Skip the `track` tool
- ❌ Use `direct_notify` for routine updates
- ❌ Send vague notifications
- ❌ Forget to call `track({action: "end"})`

---

## Troubleshooting

### Notifications Not Sending

1. Check `BARK_KEY` is correct
2. Ensure Bark iOS app is installed
3. Verify `track` was called at start and end
4. Check if conversation lasted >60 seconds
5. Check if user was focused on IDE (notifications suppressed during IDE focus)

### Agent Not Calling Tools

1. Check AGENTS.md is being read
2. Verify tool descriptions are clear
3. Ensure mandatory requirements are stated
4. Check for typos in tool names

---

## Development

### Project Structure

```
src/
├── index.ts           # MCP server entry
├── bark-client.ts     # Bark HTTP client
├── ide-detector.ts    # Cross-platform IDE detection
└── task-tracker.ts    # Task timing management
```

### Supported Platforms

- macOS
- Windows
- Linux

### IDE Detection

Automatically detects: VS Code, Cursor, JetBrains IDEs, Xcode, Terminal emulators, and more.

---

## Remember

**The golden rule:** Every conversation starts with `track({action: "start"})` and ends with `track({action: "end"})`. No exceptions.
