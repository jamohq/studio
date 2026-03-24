import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ActivityEntry, ActivityPhase } from '../hooks/useActivityFeed';
import type { ActionActivity } from '../hooks/useActionRunner';
import type { TaskItem } from '../../shared/types';
import TaskList from './TaskList';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  modified: { label: 'M', className: 'bg-yellow-500/20 text-yellow-400' },
  added: { label: 'A', className: 'bg-green-500/20 text-green-400' },
  deleted: { label: 'D', className: 'bg-red-500/20 text-red-400' },
  untracked: { label: '?', className: 'bg-blue-500/20 text-blue-400' },
  renamed: { label: 'R', className: 'bg-purple-500/20 text-purple-400' },
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface ActivityPanelProps {
  entries: ActivityEntry[];
  phase: ActivityPhase;
  summaryMessage: string;
  elapsedSeconds: number;
  actionLabel: string;
  activityLog: ActionActivity[];
  tasks: TaskItem[];
  onFileClick: (path: string) => void;
  onDismiss: () => void;
  onCancel: () => void;
}

export default function ActivityPanel({
  entries,
  phase,
  summaryMessage,
  elapsedSeconds,
  actionLabel,
  activityLog,
  tasks,
  onFileClick,
  onDismiss,
  onCancel,
}: ActivityPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const isRunning = phase === 'analyzing' || phase === 'active';

  // Auto-scroll the log when new steps arrive.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [activityLog.length, entries.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col">
        <div ref={logRef} className="flex-1 overflow-auto px-1 py-1">
          {/* Stacking activity log */}
          {activityLog.length > 0 && (
            <div className="space-y-0.5 py-1">
              {activityLog.map((step, j) => {
                const isActive = isRunning && j === activityLog.length - 1;
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

          {/* Empty state — no log entries yet */}
          {activityLog.length === 0 && phase === 'analyzing' && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-[13px] text-foreground-muted">
                {actionLabel ? `${actionLabel}...` : 'Working...'}
              </span>
              <span className="text-[11px] text-foreground-dim">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <div className="px-2 py-1">
              <TaskList tasks={tasks} />
            </div>
          )}

          {/* File changes */}
          {entries.length > 0 && (
            <div className="border-t mt-1 pt-1">
              {entries.map((entry) => {
                const badge = STATUS_BADGE[entry.status] || STATUS_BADGE.modified;
                return (
                  <button
                    key={entry.path}
                    onClick={() => onFileClick(entry.path)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-accent-bg transition-colors cursor-pointer w-full text-left"
                  >
                    <span className={cn('px-1 rounded text-[10px] font-mono font-bold shrink-0', badge.className)}>
                      {badge.label}
                    </span>
                    <span className="truncate text-foreground-muted">{entry.path}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Completion section */}
        {(phase === 'done' || phase === 'error') && (
          <div className="shrink-0 border-t px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn(
                'text-[11px] font-semibold',
                phase === 'done' ? 'text-green-400' : 'text-red-400',
              )}>
                {phase === 'done' ? 'Completed' : 'Error'}
              </span>
              <span className="text-[10px] text-foreground-dim">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            {summaryMessage && (
              <pre className="text-[11px] text-foreground-dim font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-auto">
                {summaryMessage}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
