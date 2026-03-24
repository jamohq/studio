import { useState, useCallback, useEffect, useRef } from 'react';
import type { EnvCheckResult, ChatStreamChunk, TaskItem } from '../../shared/types';

export type ActionStatus = 'idle' | 'running' | 'done' | 'error';

export interface ActionActivity {
  toolName: string;
  description: string;
}

function describeToolUse(name: string, input: string): string {
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    switch (name) {
      case 'Read': return `Reading ${parsed.file_path?.split('/').pop() || 'file'}`;
      case 'Edit': return `Editing ${parsed.file_path?.split('/').pop() || 'file'}`;
      case 'Write': return `Writing ${parsed.file_path?.split('/').pop() || 'file'}`;
      case 'Grep': return `Searching for "${parsed.pattern?.slice(0, 30) || '...'}"`;
      case 'Glob': return `Finding files matching ${parsed.pattern?.slice(0, 30) || '...'}`;
      case 'Bash': return `Running command`;
      case 'Agent': return `Running sub-agent`;
      default: return `Using ${name}`;
    }
  } catch {
    return `Using ${name}`;
  }
}

/** Duration (ms) to show the completion status before resetting to idle. */
const STATUS_RESET_DELAY_MS = 6000;

export function useActionRunner(workspaceId: string | null) {
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionLabel, setActionLabel] = useState('');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentActivity, setCurrentActivity] = useState<ActionActivity | null>(null);
  const [activityLog, setActivityLog] = useState<ActionActivity[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [fileChanges, setFileChanges] = useState<string[]>([]);

  // Listen to stream events for the current action run.
  useEffect(() => {
    const unsub = window.jamo.onChatStream((chunk: ChatStreamChunk) => {
      if (!currentRunId || chunk.runId !== currentRunId) return;

      if (chunk.toolUse) {
        const activity: ActionActivity = {
          toolName: chunk.toolUse.name,
          description: describeToolUse(chunk.toolUse.name, chunk.toolUse.input),
        };
        setCurrentActivity(activity);
        setActivityLog((prev) => [...prev, activity]);
      }

      if (chunk.tasks) {
        setTasks(chunk.tasks);
      }
      if (chunk.taskCreate) {
        setTasks((prev) => [...prev, {
          id: `task_${Date.now()}`,
          content: chunk.taskCreate!.subject,
          status: (chunk.taskCreate!.status as TaskItem['status']) || 'pending',
        }]);
      }
      if (chunk.taskUpdate) {
        setTasks((prev) => prev.map((t) =>
          t.id === chunk.taskUpdate!.taskId
            ? { ...t, status: (chunk.taskUpdate!.status as TaskItem['status']) || t.status, content: chunk.taskUpdate!.subject || t.content }
            : t
        ));
      }

      if (chunk.fileChange) {
        // File paths from Claude's Edit/Write tools are absolute — store as-is,
        // deduplication handles both forms.
        setFileChanges((prev) =>
          prev.includes(chunk.fileChange!) ? prev : [...prev, chunk.fileChange!],
        );
      }

      if (chunk.status === 'completed') {
        setActionStatus('done');
        setCurrentActivity(null);
        setTimeout(
          () => setActionStatus((s) => (s === 'done' ? 'idle' : s)),
          STATUS_RESET_DELAY_MS,
        );
      } else if (chunk.status === 'error') {
        setActionStatus('error');
        setCurrentActivity(null);
        setTimeout(
          () => setActionStatus((s) => (s === 'error' ? 'idle' : s)),
          STATUS_RESET_DELAY_MS,
        );
      }
    });

    return unsub;
  }, [currentRunId]);

  const sendAction = useCallback(async (prompt: string, label: string): Promise<EnvCheckResult | null> => {
    if (!workspaceId) return null;

    // Gate on environment check before dispatching.
    const envResult = await window.jamo.checkEnvironment();
    if (!envResult.ready) return envResult;

    setActionStatus('running');
    setActionLabel(label);
    setCurrentActivity(null);
    setActivityLog([]);
    setTasks([]);
    setFileChanges([]);

    try {
      const result = await window.jamo.chatSend(workspaceId, prompt, {}, undefined);
      setCurrentRunId(result.runId);
    } catch (err: any) {
      console.error('[ActionRunner] Failed to start:', err);
      setActionStatus('error');
      setActionLabel('');
    }

    return null;
  }, [workspaceId]);

  const cancelAction = useCallback(() => {
    if (actionStatus !== 'running') return;
    if (currentRunId) {
      window.jamo.chatCancel(currentRunId);
    }
    setActionStatus('idle');
    setActionLabel('');
    setCurrentActivity(null);
    setCurrentRunId(null);
  }, [actionStatus, currentRunId]);

  return { actionStatus, actionLabel, currentActivity, activityLog, tasks, fileChanges, sendAction, cancelAction };
}
