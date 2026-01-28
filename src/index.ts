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

// Define tools with simplified descriptions
const START_TASK_TOOL: Tool = {
  name: 'start_task',
  description: `Start tracking this conversation session. Call this ONCE at the beginning of every chat.

SIMPLE USAGE:
- Call start_task when the conversation starts
- Call end_task when the conversation ends
- That's it!

The system will automatically:
- Track how long the conversation takes
- Send a notification if it exceeds 60 seconds and user left IDE
- Stay silent if user is still focused on IDE

EXAMPLE:
start_task({task_id: "chat-2024-001", task_name: "Code review session"})`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Unique identifier for this conversation (e.g., "chat-timestamp")',
      },
      task_name: {
        type: 'string',
        description: 'Description of what this conversation is about',
      },
    },
    required: ['task_id', 'task_name'],
  },
};

const END_TASK_TOOL: Tool = {
  name: 'end_task',
  description: `End this conversation session. Call this ONCE at the end of every chat.

SIMPLE USAGE:
- Call end_task when you're done with the conversation
- Must use the same task_id from start_task
- That's it!

NOTIFICATION LOGIC (automatic):
- If conversation >60s AND user left IDE → sends notification
- Otherwise → silent completion

EXAMPLE:
end_task({task_id: "chat-2024-001"})`,
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
  description: `Send immediate notification to user's iPhone via Bark.

WHEN TO USE:
- Urgent situations requiring immediate user attention
- When user needs to make a decision
- Important alerts that can't wait

【IMPORTANT】Before calling notify:
1. Tell user: "I need to send a notification to your phone"
2. Explain what the notification is about
3. Then call notify

RULES:
- Title MUST be "Nyantify"
- Body must be clear and specific
- Never use vague messages

GOOD: "Code review needed: Add Redis cache to UserService? Query takes 2.3s"
BAD: "Check this" or "Done"`,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'MUST be "Nyantify"',
      },
      body: {
        type: 'string',
        description: 'Clear message explaining what user needs to know or do',
      },
      level: {
        type: 'string',
        enum: ['active', 'timeSensitive', 'passive'],
        description: 'timeSensitive for urgent matters (shows during Focus mode)',
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
