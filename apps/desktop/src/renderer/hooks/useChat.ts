import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChatMessage, ChatStreamChunk, ChatContext, TaskItem } from '../../shared/types';
import { buildChatContext } from '../chat-context';

export type ChatStatus = 'idle' | 'running' | 'done' | 'error';

export interface ChatActivity {
  toolName: string;
  description: string;
  timestamp: number;
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

export function useChat(workspaceId: string | null, openFile: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [fileChanges, setFileChanges] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentActivity, setCurrentActivity] = useState<ChatActivity | null>(null);
  const [activityLog, setActivityLog] = useState<ChatActivity[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Elapsed timer
  useEffect(() => {
    if (status === 'running') {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      startTimeRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // Subscribe to chat stream events
  useEffect(() => {
    const unsub = window.jamo.onChatStream((chunk: ChatStreamChunk) => {
      if (chunk.toolUse) {
        const activity: ChatActivity = {
          toolName: chunk.toolUse.name,
          description: describeToolUse(chunk.toolUse.name, chunk.toolUse.input),
          timestamp: Date.now(),
        };
        setCurrentActivity(activity);
        setActivityLog((prev) => [...prev, activity]);
      }

      // TodoWrite — full task list replacement
      if (chunk.tasks) {
        setTasks(chunk.tasks);
      }

      // TaskCreate — append a new task
      if (chunk.taskCreate) {
        setTasks((prev) => [...prev, {
          id: `task_${Date.now()}`,
          content: chunk.taskCreate!.subject,
          status: (chunk.taskCreate!.status as TaskItem['status']) || 'pending',
        }]);
      }

      // TaskUpdate — update an existing task's status
      if (chunk.taskUpdate) {
        setTasks((prev) => prev.map((t) =>
          t.id === chunk.taskUpdate!.taskId
            ? { ...t, status: (chunk.taskUpdate!.status as TaskItem['status']) || t.status, content: chunk.taskUpdate!.subject || t.content }
            : t
        ));
      }

      if (chunk.delta) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.runId === chunk.runId) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + chunk.delta },
            ];
          } else {
            return [
              ...prev,
              {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: chunk.delta || '',
                timestamp: new Date().toISOString(),
                runId: chunk.runId,
              },
            ];
          }
        });
      }

      if (chunk.fileChange) {
        setFileChanges((prev) =>
          prev.includes(chunk.fileChange!) ? prev : [...prev, chunk.fileChange!]
        );
      }

      if (chunk.sessionId) {
        setSessionId(chunk.sessionId);
      }

      if (chunk.status === 'completed') {
        setStatus('done');
        setCurrentActivity(null);
      } else if (chunk.status === 'error') {
        setStatus('error');
        setErrorMessage(chunk.error || 'Something went wrong');
        setCurrentActivity(null);
      } else if (chunk.status === 'cancelled') {
        setStatus('idle');
        setCurrentActivity(null);
      }
    });

    return unsub;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!workspaceId || status === 'running') return;

      setStatus('running');
      setFileChanges([]);
      setErrorMessage(null);
      setActivityLog([]);
      setTasks([]);

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      const updatedMessages = [...messagesRef.current, userMsg];
      setMessages(updatedMessages);

      try {
        const context = await buildChatContext(workspaceId, openFile);
        const priorMessages = updatedMessages.slice(0, -1);
        const result = await window.jamo.chatSend(
          workspaceId,
          text,
          context,
          priorMessages.length > 0 ? priorMessages : undefined,
        );
        setCurrentRunId(result.runId);
      } catch (err: any) {
        console.error('[Chat] Send failed:', err);
        setStatus('error');
        setErrorMessage(err.message || String(err));
      }
    },
    [workspaceId, openFile, status]
  );

  const cancelRun = useCallback(() => {
    if (currentRunId) {
      window.jamo.chatCancel(currentRunId);
    }
  }, [currentRunId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentRunId(null);
    setFileChanges([]);
    setSessionId(null);
    setStatus('idle');
    setErrorMessage(null);
    setCurrentActivity(null);
    setActivityLog([]);
    setTasks([]);
    setElapsedSeconds(0);
  }, []);

  const saveLog = useCallback(async () => {
    if (!workspaceId || messages.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Convert messages to markdown
    let md = `# Chat Log — ${new Date().toLocaleString()}\n\n`;
    md += `**Model:** Claude Code CLI\n\n---\n\n`;

    for (const msg of messages) {
      const label = msg.role === 'user' ? 'You' : 'Assistant';
      md += `**${label}:** ${msg.content}\n\n---\n\n`;
    }

    // Write the file
    const filePath = `.jamo/chat-logs/${timestamp}.md`;
    try {
      // Ensure directory exists
      try { await window.jamo.createDirectory(workspaceId, '.jamo/chat-logs'); } catch { /* may exist */ }
      await window.jamo.writeFile(workspaceId, filePath, md);

      // Commit with chat-log tag
      const firstMsg = messages.find((m) => m.role === 'user')?.content || 'conversation';
      const desc = `Chat: ${firstMsg.slice(0, 60)}${firstMsg.length > 60 ? '...' : ''}`;
      await window.jamo.smartCommit(workspaceId, {
        tag: 'chat-log',
        description: desc,
        source: 'manual',
      });
    } catch (err) {
      console.error('[Chat] Save log failed:', err);
      throw err;
    }
  }, [workspaceId, messages]);

  return {
    messages,
    status,
    errorMessage,
    currentRunId,
    fileChanges,
    currentActivity,
    activityLog,
    tasks,
    elapsedSeconds,
    sendMessage,
    cancelRun,
    clearChat,
    saveLog,
  };
}
