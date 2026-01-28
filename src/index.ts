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
import path from 'path';

// Configuration from environment variables
const BARK_KEY = process.env.BARK_KEY || '';
const BARK_BASE_URL = process.env.BARK_BASE_URL || 'https://api.day.app';
const MIN_DURATION_SECONDS = parseInt(process.env.MIN_DURATION_SECONDS || '60', 10);
const IDE_BUNDLE_IDS = process.env.IDE_BUNDLE_IDS?.split(',') || [];
const LANGUAGE = process.env.LANGUAGE || 'en';

// Get current directory name as project name
const PROJECT_NAME = path.basename(process.cwd());

if (!BARK_KEY) {
  console.error('Error: BARK_KEY environment variable is required');
  process.exit(1);
}

// Hardcoded i18n titles for notifications
const NOTIFICATION_TITLES: Record<string, string> = {
  en: 'Task Completed',
  zh: '任务完成',
  ja: 'タスク完了',
};

// Initialize components
const barkClient = new BarkClient(BARK_KEY, BARK_BASE_URL);
const ideConfig: IDEDetectorConfig = {
  ideIdentifiers: IDE_BUNDLE_IDS.length > 0 ? IDE_BUNDLE_IDS : undefined as any,
};
const ideDetector = new IDEDetector(ideConfig);
const taskTracker = new TaskTracker(MIN_DURATION_SECONDS);

// Helper to format duration in simple format
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return `${mins}min`;
  }
  return `${mins}min${secs}s`;
}

// Define tools with clear action-oriented descriptions
const START_TASK_TOOL: Tool = {
  name: 'nyantify_start',
  description: `STEP 1 OF 2: Call this FIRST before doing anything else.

ACTION: Start tracking this conversation session.
WHEN: Right now, before your first response.

Parameters:
- task_id: Unique ID (e.g., "chat-2024-01-28-001")
- task_name: Brief description of this conversation topic

DO THIS NOW, THEN REPLY TO USER.`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Unique conversation ID',
      },
      task_name: {
        type: 'string',
        description: 'What this conversation is about',
      },
    },
    required: ['task_id', 'task_name'],
  },
};

const END_TASK_TOOL: Tool = {
  name: 'nyantify_end',
  description: `STEP 2 OF 2: Call this LAST after completing your response.

ACTION: End tracking this conversation session.
WHEN: After your final reply, before finishing.

Parameters:
- task_id: Same ID from nyantify_start
- force_notify: (optional) Set true to always notify

DO THIS LAST, THEN YOU'RE DONE.`,
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Same ID from nyantify_start',
      },
      force_notify: {
        type: 'boolean',
        description: 'Force notification (default: false)',
        default: false,
      },
    },
    required: ['task_id'],
  },
};

const NOTIFY_TOOL: Tool = {
  name: 'nyantify_notify',
  description: `Send immediate notification to user's iPhone via Bark.

CURRENT LANGUAGE SETTING: ${LANGUAGE}
- Use this language for the notification body

WHEN TO USE:
- Urgent situations requiring immediate user attention
- When user needs to make a decision
- Important alerts that can't wait

【IMPORTANT】Before calling notify:
1. Tell user: "${LANGUAGE === 'zh' ? '我需要发送通知到您的手机' : LANGUAGE === 'ja' ? 'お知らせを送信します' : 'I need to send a notification to your phone'}"
2. Explain what the notification is about
3. Then call notify

RULES:
- Title MUST be "Nyantify"
- Body must be clear and specific (in ${LANGUAGE})
- Never use vague messages

GOOD (${LANGUAGE}): "${LANGUAGE === 'zh' ? '代码审查：是否在UserService中添加Redis缓存？查询耗时2.3秒' : LANGUAGE === 'ja' ? 'コードレビュー：UserServiceにRedisキャッシュを追加しますか？クエリ実行時間2.3秒' : 'Code review: Add Redis cache to UserService? Query takes 2.3s'}"
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
        description: `Clear message in ${LANGUAGE} explaining what user needs to know`,
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
      case 'nyantify_start': {
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

      case 'nyantify_end': {
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
            const formattedDuration = formatDuration(durationSeconds);
            
            // Use hardcoded title based on language setting
            const titleText = NOTIFICATION_TITLES[LANGUAGE] || NOTIFICATION_TITLES['en'];
            
            const barkOptions: BarkOptions = {
              title: `Nyantify · ${titleText} · ${formattedDuration}`,
              body: result.name,
              subtitle: PROJECT_NAME,
              group: 'nyantify',
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

        const formattedDuration = formatDuration(durationSeconds);
        return {
          content: [
            {
              type: 'text',
              text: `Task "${result.name}" completed in ${formattedDuration}. No notification needed (you're focused on IDE).`,
            },
          ],
        };
      }

      case 'nyantify_notify': {
        const { title, body, level } = args as {
          title: string;
          body: string;
          level?: 'active' | 'timeSensitive' | 'passive';
        };

        const barkOptions: BarkOptions = {
          title,
          body,
          group: 'nyantify-notifications',
          level: level || 'timeSensitive',
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
