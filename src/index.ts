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

// Define tools
const START_TASK_TOOL: Tool = {
  name: 'start_task',
  description: 'Start tracking a new task. Call this when beginning a potentially long-running operation.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Unique identifier for this task',
      },
      task_name: {
        type: 'string',
        description: 'Human-readable name/description of the task',
      },
    },
    required: ['task_id', 'task_name'],
  },
};

const END_TASK_TOOL: Tool = {
  name: 'end_task',
  description: 'End a tracked task. If the task took longer than the threshold and the user is not focused on an IDE, a notification will be sent via Bark.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'The task identifier provided to start_task',
      },
      force_notify: {
        type: 'boolean',
        description: 'Force send a notification even if duration is short',
        default: false,
      },
    },
    required: ['task_id'],
  },
};

const NOTIFY_TOOL: Tool = {
  name: 'notify',
  description: 'Send an immediate notification via Bark. Use this for urgent messages that require user attention or decision-making.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Notification title',
      },
      body: {
        type: 'string',
        description: 'Notification body content',
      },
      subtitle: {
        type: 'string',
        description: 'Notification subtitle (optional)',
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
        description: 'Notification level (optional)',
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
