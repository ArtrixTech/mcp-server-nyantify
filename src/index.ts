#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { BarkClient, BarkOptions } from './bark-client.js';
import { IDEDetector, IDEDetectorConfig } from './ide-detector.js';
import { TaskTracker } from './task-tracker.js';

// Configuration from environment variables
const BARK_KEY = process.env.BARK_KEY || '';
const BARK_BASE_URL = process.env.BARK_BASE_URL || 'https://api.day.app';
const MIN_DURATION_SECONDS = parseInt(process.env.MIN_DURATION_SECONDS || '60', 10);
const IDE_BUNDLE_IDS = process.env.IDE_BUNDLE_IDS?.split(',') || [];

if (!BARK_KEY) {
  console.error('Error: BARK_KEY environment variable is required');
  process.exit(1);
}

// Initialize components
const barkClient = new BarkClient(BARK_KEY, BARK_BASE_URL);
const ideConfig: IDEDetectorConfig = {
  ideIdentifiers: IDE_BUNDLE_IDS.length > 0 ? IDE_BUNDLE_IDS : undefined as any,
};
const ideDetector = new IDEDetector(ideConfig);
const taskTracker = new TaskTracker(MIN_DURATION_SECONDS);

// Define tools with comprehensive descriptions
const START_TASK_TOOL: Tool = {
  name: 'start_task',
  description: `【MANDATORY】Start tracking a new task. Call this BEFORE every potentially long-running operation (build, test, deploy, etc.).

REQUIRED USAGE:
- Must call start_task before any operation that could take >10 seconds
- Must pair with end_task when operation completes
- Use descriptive task_name so user understands what's happening

EXAMPLE FLOW:
1. start_task({task_id: "build-001", task_name: "Building project"})
2. Execute the actual operation
3. end_task({task_id: "build-001"})

WHY THIS MATTERS:
- Lets user know a task is in progress
- Enables intelligent notifications for long tasks when user leaves IDE
- Prevents user from thinking the operation froze`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Unique identifier for this task (use format: operation-type-timestamp)',
      },
      task_name: {
        type: 'string',
        description: 'Human-readable description of what this task does',
      },
    },
    required: ['task_id', 'task_name'],
  },
};

const END_TASK_TOOL: Tool = {
  name: 'end_task',
  description: `【MANDATORY】End a tracked task. Call this AFTER the operation completes. Must pair with start_task.

NOTIFICATION LOGIC:
- If duration >60s AND user not focused on IDE: Sends notification
- If duration <60s OR user in IDE: No notification (silent completion)
- Use force_notify=true to override and always notify

EXAMPLE:
end_task({task_id: "build-001"})  // Uses automatic logic
end_task({task_id: "build-001", force_notify: true})  // Always notify

NOTE: Notification only sends if task took >60s (configurable) and user left IDE.`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'The task identifier from start_task (must match exactly)',
      },
      force_notify: {
        type: 'boolean',
        description: 'Force notification regardless of duration (default: false)',
        default: false,
      },
    },
    required: ['task_id'],
  },
};

const NOTIFY_TOOL: Tool = {
  name: 'notify',
  description: `Send immediate notification via Bark to user's iPhone. Use for urgent situations requiring user attention.

【CRITICAL】USER CONFIRMATION REQUIRED:
Before calling notify, you MUST warn the user. Example:
"I need to send a notification to your phone. Please confirm..."
"I'm now sending the notification to your iPhone."

NOTIFY USAGE RULES:
1. Title MUST be "Nyantify" (fixed)
2. Body must be clear and specific about what user needs to do
3. Only use for urgent decisions or important alerts
4. Never send vague messages like "look at this" or "check this"

GOOD EXAMPLES:
- "Code review needed: Should I add Redis cache to UserService? Query takes 2.3s"
- "Tests completed: 3 failures in auth module, need your decision on fix approach"

BAD EXAMPLES:
- "Done" (too vague)
- "Check this" (unclear action)`,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'MUST be "Nyantify"',
      },
      body: {
        type: 'string',
        description: 'Clear, specific message explaining what user needs to do',
      },
      subtitle: {
        type: 'string',
        description: 'Additional context (optional)',
      },
      sound: {
        type: 'string',
        description: 'Sound name (optional)',
      },
      group: {
        type: 'string',
        description: 'Notification group (optional)',
      },
      level: {
        type: 'string',
        enum: ['active', 'timeSensitive', 'passive'],
        description: 'timeSensitive recommended for urgent matters (shows during Focus mode)',
      },
      url: {
        type: 'string',
        description: 'URL to open when notification is clicked (optional)',
      },
    },
    required: ['title', 'body'],
  },
};

// Create server
const server = new Server(
  {
    name: 'nyantify-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [START_TASK_TOOL, END_TASK_TOOL, NOTIFY_TOOL],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'start_task': {
        const { task_id, task_name } = args as { task_id: string; task_name: string };
        taskTracker.startTask(task_id, task_name);
        return {
          content: [
            {
              type: 'text',
              text: `Task "${task_name}" (${task_id}) started tracking.`,
            },
          ],
        };
      }

      case 'end_task': {
        const { task_id, force_notify = false } = args as { task_id: string; force_notify?: boolean };
        const result = taskTracker.endTask(task_id, force_notify);
        
        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: `Task ${task_id} not found.`,
              },
            ],
            isError: true,
          };
        }

        const durationSeconds = Math.round(result.duration / 1000);
        
        // Check if we should send notification
        if (result.shouldNotify) {
          const isIDEFocused = await ideDetector.isIDEFocused();
          
          if (!isIDEFocused || force_notify) {
            const frontApp = await ideDetector.getFrontmostApplicationName();
            const barkOptions: BarkOptions = {
              title: 'Task Completed',
              body: `"${result.name}" finished after ${durationSeconds}s`,
              subtitle: `You were using: ${frontApp}`,
              group: 'nyantify-tasks',
              level: 'timeSensitive',
            };
            
            await barkClient.send(barkOptions);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Task "${result.name}" completed in ${durationSeconds}s. Notification sent (you were using ${frontApp}).`,
                },
              ],
            };
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Task "${result.name}" completed in ${durationSeconds}s. No notification needed (you're focused on IDE).`,
            },
          ],
        };
      }

      case 'notify': {
        const { title, body, subtitle, sound, group, level, url } = args as {
          title: string;
          body: string;
          subtitle?: string;
          sound?: string;
          group?: string;
          level?: 'active' | 'timeSensitive' | 'passive';
          url?: string;
        };

        const barkOptions: BarkOptions = {
          title,
          body,
          subtitle,
          sound,
          group: group || 'nyantify-notifications',
          level: level || 'timeSensitive',
          url,
        };

        await barkClient.send(barkOptions);

        return {
          content: [
            {
              type: 'text',
              text: `Notification sent: "${title}"`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Nyantify MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
