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
import { I18n, Language } from './i18n.js';

// Configuration from environment variables
const BARK_KEY = process.env.BARK_KEY || '';
const BARK_BASE_URL = process.env.BARK_BASE_URL || 'https://api.day.app';
const MIN_DURATION_SECONDS = parseInt(process.env.MIN_DURATION_SECONDS || '60', 10);
const IDE_BUNDLE_IDS = process.env.IDE_BUNDLE_IDS?.split(',') || [];
const LANGUAGE = (process.env.LANGUAGE || 'en') as Language;

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
const i18n = new I18n(LANGUAGE);

// Define tools with mandatory descriptions
const START_TASK_TOOL: Tool = {
  name: 'start_task',
  description: `[MANDATORY] Call this tool IMMEDIATELY at the start of EVERY conversation.

⚠️ CRITICAL: You MUST call start_task BEFORE doing anything else in this conversation.
⚠️ CRITICAL: Every conversation MUST start with start_task.

WHY THIS IS REQUIRED:
- Tracks how long the conversation takes
- Enables notifications when conversations run long and user leaves IDE
- Required for the notification system to work properly

EXAMPLE - First thing you do:
1. start_task({task_id: "chat-20240128-001", task_name: "Helping with React component"})
2. Then proceed with the conversation

FAILURE TO CALL: The system won't track this conversation and notifications won't work.`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Unique ID for this conversation (format: chat-YYYYMMDD-NNN)',
      },
      task_name: {
        type: 'string',
        description: 'Brief description of what this conversation is about',
      },
    },
    required: ['task_id', 'task_name'],
  },
};

const END_TASK_TOOL: Tool = {
  name: 'end_task',
  description: `[MANDATORY] Call this tool at the END of EVERY conversation before responding.

⚠️ CRITICAL: You MUST call end_task AFTER completing your response.
⚠️ CRITICAL: Every conversation MUST end with end_task.

WHY THIS IS REQUIRED:
- Completes the conversation tracking
- Triggers notification if conversation was long and user left IDE
- Required to pair with the start_task call

EXAMPLE - Last thing you do:
1. Complete your response to the user
2. end_task({task_id: "chat-20240128-001"})

FAILURE TO CALL: The conversation remains unfinished and user won't get notifications.`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Same task_id from start_task (MUST match exactly)',
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
            const formattedDuration = i18n.formatDuration(durationSeconds);
            
            // New format: Nyantify|SimpleTitle
            // Body: task name only
            const barkOptions: BarkOptions = {
              title: `Nyantify|${i18n.t('taskCompleted')}`,
              body: result.name,
              subtitle: `${formattedDuration} · ${frontApp}`,
              group: 'nyantify-tasks',
              level: 'timeSensitive',
            };
            
            await barkClient.send(barkOptions);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Task "${result.name}" completed in ${formattedDuration}. Notification sent (you were using ${frontApp}).`,
                },
              ],
            };
          }
        }

        const formattedDuration = i18n.formatDuration(durationSeconds);
        return {
          content: [
            {
              type: 'text',
              text: `Task "${result.name}" completed in ${formattedDuration}. No notification needed (you're focused on IDE).`,
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
