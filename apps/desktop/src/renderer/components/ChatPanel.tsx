import React, { useEffect, useRef, useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ChatMessage, TaskItem } from '../../shared/types';
import type { ChatStatus, ChatActivity } from '../hooks/useChat';
import TaskList from './TaskList';
import ChatInput from './ChatInput';
import { useToast } from './Toast';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface ChatPanelProps {
  workspaceId: string;
  messages: ChatMessage[];
  status: ChatStatus;
  errorMessage: string | null;
  fileChanges: string[];
  currentActivity: ChatActivity | null;
  activityLog: ChatActivity[];
  tasks: TaskItem[];
  elapsedSeconds: number;
  onSend: (message: string) => void;
  onCancel: () => void;
  onClear: () => void;
  onClose: () => void;
  onFileClick: (path: string) => void;
  onSaveLog?: () => Promise<void>;
  openFile: string | null;
  showHeader?: boolean;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed',
          isUser
            ? 'bg-accent/15 text-foreground'
            : 'bg-background-deep text-foreground'
        )}
      >
        {isUser ? (
          <pre className="whitespace-pre-wrap font-sans break-words m-0">
            {message.content}
          </pre>
        ) : (
          <div className="chat-markdown prose prose-invert prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

function FileChangeBadge({ path, onClick }: { path: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
    >
      <span className="font-bold">M</span>
      <span className="truncate max-w-[150px]">{path.split('/').pop()}</span>
    </button>
  );
}

export default function ChatPanel({
  workspaceId,
  messages,
  status,
  errorMessage,
  fileChanges,
  currentActivity,
  activityLog,
  tasks,
  elapsedSeconds,
  onSend,
  onCancel,
  onClear,
  onClose,
  onFileClick,
  onSaveLog,
  openFile,
  showHeader = true,
}: ChatPanelProps) {
  const { toast } = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveLog = useCallback(async () => {
    if (!onSaveLog || saving) return;
    setSaving(true);
    try {
      await onSaveLog();
      toast({ title: 'Chat log saved', description: 'Committed to .jamo/chat-logs/', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || String(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [onSaveLog, saving, toast]);

  // Auto-scroll on new messages or activity changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content.length, activityLog.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden when embedded in tabbed panel */}
      {showHeader && (
        <div className="px-2 py-1 border-b border-l flex items-center gap-1 shrink-0">
          <span className="px-2 py-0.5 text-[11px] font-semibold uppercase text-foreground">
            Chat
          </span>

          {status === 'running' && (
            <span className="flex items-center gap-1.5 text-[11px] text-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              <span className="text-foreground-dim">{formatElapsed(elapsedSeconds)}</span>
            </span>
          )}

          <div className="flex-1" />

          {messages.length > 0 && onSaveLog && (
            <button
              onClick={handleSaveLog}
              disabled={saving}
              title="Save chat log"
              className="h-6 px-1.5 flex items-center text-[10px] text-foreground-dim hover:text-foreground-muted"
            >
              {saving ? 'Saving...' : 'Save Log'}
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={onClear}
              title="Clear chat"
              className="h-6 px-1.5 flex items-center text-[10px] text-foreground-dim hover:text-foreground-muted"
            >
              Clear
            </button>
          )}

          {status === 'running' && (
            <button
              onClick={onCancel}
              title="Cancel"
              className="h-6 px-1.5 flex items-center text-[10px] text-red-400 hover:text-red-300"
            >
              Cancel
            </button>
          )}

          <button
            onClick={onClose}
            title="Close chat"
            className="h-6 w-6 flex items-center justify-center text-foreground-muted hover:text-foreground"
          >
            <span className="text-sm leading-none">&times;</span>
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-[13px] text-foreground-dim">
              Ask a question about your code
            </span>
          </div>
        )}

        {messages.map((msg, i) => {
          // Show the activity log before the last assistant message (or at the end while running)
          const isLastAssistant = msg.role === 'assistant' && (i === messages.length - 1 || !messages.slice(i + 1).some((m) => m.role === 'assistant'));
          const showLogHere = isLastAssistant && activityLog.length > 0;

          return (
            <React.Fragment key={msg.id}>
              {showLogHere && (
                <div className="space-y-0.5 py-1">
                  {activityLog.map((step, j) => {
                    const isActive = status === 'running' && j === activityLog.length - 1;
                    return (
                      <div key={j} className="flex items-center gap-2 px-2 py-0.5 text-[11px] text-foreground-dim">
                        {isActive ? (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full border border-foreground-dim/30 shrink-0" />
                        )}
                        <span className={cn('truncate', isActive ? 'text-foreground-muted' : 'text-foreground-dim/60')}>
                          {step.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <MessageBubble message={msg} />
            </React.Fragment>
          );
        })}

        {/* Activity log when no assistant message yet (still waiting for first response) */}
        {status === 'running' && activityLog.length > 0 && !messages.some((m) => m.role === 'assistant' && m.runId) && (
          <div className="space-y-0.5 py-1">
            {activityLog.map((step, j) => {
              const isActive = j === activityLog.length - 1;
              return (
                <div key={j} className="flex items-center gap-2 px-2 py-0.5 text-[11px] text-foreground-dim">
                  {isActive ? (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 rounded-full border border-foreground-dim/30 shrink-0" />
                  )}
                  <span className={cn('truncate', isActive ? 'text-foreground-muted' : 'text-foreground-dim/60')}>
                    {step.description}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <TaskList tasks={tasks} />
        )}

        {/* File changes */}
        {fileChanges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fileChanges.map((path) => (
              <FileChangeBadge
                key={path}
                path={path}
                onClick={() => onFileClick(path)}
              />
            ))}
          </div>
        )}

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <div className="rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        disabled={status === 'running'}
        running={status === 'running'}
        onCancel={onCancel}
        openFile={openFile}
      />
    </div>
  );
}
