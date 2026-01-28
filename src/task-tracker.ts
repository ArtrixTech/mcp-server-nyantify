export interface Task {
  id: string;
  name: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  id: string;
  name: string;
  duration: number;  // in milliseconds
  shouldNotify: boolean;
}

export class TaskTracker {
  private tasks: Map<string, Task> = new Map();
  private minDurationForNotification: number;  // in milliseconds

  constructor(minDurationSeconds: number = 60) {
    this.minDurationForNotification = minDurationSeconds * 1000;
  }

  startTask(id: string, name: string, metadata?: Record<string, any>): void {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id '${id}' already exists`);
    }

    this.tasks.set(id, {
      id,
      name,
      startTime: Date.now(),
      metadata,
    });
  }

  endTask(id: string, forceNotify: boolean = false): TaskResult | null {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - task.startTime;
    
    // Should notify if:
    // 1. Duration exceeds threshold, OR
    // 2. Force notify is requested
    const shouldNotify = forceNotify || duration >= this.minDurationForNotification;

    this.tasks.delete(id);

    return {
      id: task.id,
      name: task.name,
      duration,
      shouldNotify,
    };
  }

  getRunningTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  cancelTask(id: string): boolean {
    return this.tasks.delete(id);
  }
}
