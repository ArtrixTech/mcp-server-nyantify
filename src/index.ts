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
  de: 'Aufgabe erledigt',
  fr: 'Tâche terminée',
  es: 'Tarea completada',
  ru: 'Задача завершена',
  ko: '작업 완료',
  pt: 'Tarefa concluída',
  it: 'Attività completata',
  ar: 'تمت المهمة',
  hi: 'कार्य पूर्ण',
  vi: 'Đã hoàn thành',
  th: 'งานเสร็จสิ้น',
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

// Define tools with mandatory calling requirements
const TRACK_TOOL: Tool = {
  name: 'track',
  description: `REQUIRED: Call this at the START and END of processing EVERY user message to track task duration and notify the user when long tasks complete.

IMPORTANT CLARIFICATION:
- This tracks EACH user message processing, NOT the entire multi-turn conversation
- Every time the user sends a message, you must call track(action="start") at the beginning and track(action="end") at the end

WHEN TO CALL:
- action="start": IMMEDIATELY when the user sends a message, BEFORE you start processing it
- action="end": RIGHT AFTER you finish your response to that message

WHY THIS MATTERS:
Without tracking each message processing, the user won't receive iPhone notifications when AI tasks complete. They may:
- Waste time staring at the screen waiting
- Forget to check back and abandon tasks
- Not know if the task succeeded or failed

WORKFLOW FOR EACH USER MESSAGE:
1. User sends a message
2. Call track({action: "start", task_id: "msg-YYYYMMDD-NNN", task_name: "brief description"})
3. Process the request and generate your response
4. Call track({action: "end", task_id: "msg-YYYYMMDD-NNN"})
5. Send your response to the user

NOTIFICATION LOGIC:
- If message processing >60 seconds AND user left IDE → Sends iPhone notification
- Otherwise → Silent completion (no notification needed)

EXAMPLE:
User: "Refactor the auth module"
→ track({action: "start", task_id: "msg-2024-01-28-001", task_name: "Refactoring authentication module"})
→ Process and generate response
→ track({action: "end", task_id: "msg-2024-01-28-001"})
→ Send response to user

⚠️ NEVER skip this tool. Call it for EVERY user message you process. User relies on notifications for long-running tasks.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'end'],
        description: 'Use "start" at conversation begin, "end" at conversation finish',
      },
      task_id: {
        type: 'string',
        description: 'Unique conversation ID (use format: chat-YYYYMMDD-NNN)',
      },
      task_name: {
        type: 'string',
        description: 'Brief description of what this conversation is about (required when action=start)',
      },
    },
    required: ['action', 'task_id'],
  },
};

const DIRECT_NOTIFY_TOOL: Tool = {
  name: 'direct_notify',
  description: `[WHEN NEEDED] Send immediate notification to user's iPhone.

USE ONLY WHEN:
- Urgent situation requiring immediate user attention
- User must make a time-sensitive decision
- Critical alert that cannot wait for task completion

⚠️ REQUIRED: Must warn user before calling this tool.
Example: "I need to send a notification to your phone about [reason]"

⚠️ FORMAT: Title MUST be "Nyantify"
⚠️ CONTENT: Must be clear, specific, and actionable
⚠️ NEVER use for routine updates or minor status changes

GOOD EXAMPLES:
- "Production database connection failed. Immediate action required."
- "Security vulnerability detected in dependencies. Need decision on fix."
- "Deployment failed on staging. Rollback or retry?"

BAD EXAMPLES:
- "Done" (too vague)
- "Check this" (unclear what to check)
- "Task finished" (use track instead)`,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'MUST be exactly: "Nyantify"',
        enum: ['Nyantify'],
      },
      body: {
        type: 'string',
        description: 'Clear, urgent message explaining what requires user attention',
      },
      level: {
        type: 'string',
        enum: ['active', 'timeSensitive', 'passive'],
        default: 'timeSensitive',
        description: 'timeSensitive = shows even in Focus mode (default for urgency)',
      },
    },
    required: ['title', 'body'],
  },
};

// Create server
const server = new Server(
  {
    name: 'nyantify-mcp-server',
    version: '1.1.0',
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
    tools: [TRACK_TOOL, DIRECT_NOTIFY_TOOL],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'track': {
        const { action, task_id, task_name } = args as { 
          action: 'start' | 'end'; 
          task_id: string; 
          task_name?: string;
        };

        if (action === 'start') {
          if (!task_name) {
            return {
              content: [{ type: 'text', text: 'Error: task_name is required for action=start' }],
              isError: true,
            };
          }
          taskTracker.startTask(task_id, task_name);
          return {
            content: [{ type: 'text', text: `✓ Tracking started: ${task_name}` }],
          };
        }

        if (action === 'end') {
          const result = taskTracker.endTask(task_id);
          
          if (!result) {
            return {
              content: [{ type: 'text', text: `Task ${task_id} not found.` }],
              isError: true,
            };
          }

          const durationSeconds = Math.round(result.duration / 1000);
          
          if (result.shouldNotify) {
            const isIDEFocused = await ideDetector.isIDEFocused();
            
            if (!isIDEFocused) {
              const frontApp = await ideDetector.getFrontmostApplicationName();
              const formattedDuration = formatDuration(durationSeconds);
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
                content: [{ type: 'text', text: `✓ Task completed in ${formattedDuration}. Notification sent (you were using ${frontApp}).` }],
              };
            }
          }

          const formattedDuration = formatDuration(durationSeconds);
          return {
            content: [{ type: 'text', text: `✓ Task completed in ${formattedDuration}. No notification needed (you're focused on IDE).` }],
          };
        }

        return {
          content: [{ type: 'text', text: `Unknown action: ${action}` }],
          isError: true,
        };
      }

      case 'direct_notify': {
        const { title, body, level } = args as {
          title: string;
          body: string;
          level?: 'active' | 'timeSensitive' | 'passive';
        };

        const barkOptions: BarkOptions = {
          title,
          body,
          group: 'nyantify',
          level: level || 'timeSensitive',
        };

        await barkClient.send(barkOptions);

        return {
          content: [{ type: 'text', text: `✓ Notification sent: "${title}"` }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
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
