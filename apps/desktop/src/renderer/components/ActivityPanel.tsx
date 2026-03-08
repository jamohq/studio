import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ActivityEntry, ActivityPhase } from '../hooks/useActivityFeed';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  modified: { label: 'M', className: 'bg-yellow-500/20 text-yellow-400' },
  added: { label: 'A', className: 'bg-green-500/20 text-green-400' },
  deleted: { label: 'D', className: 'bg-red-500/20 text-red-400' },
  untracked: { label: '?', className: 'bg-blue-500/20 text-blue-400' },
  renamed: { label: 'R', className: 'bg-purple-500/20 text-purple-400' },
};

interface ActivityPanelProps {
  entries: ActivityEntry[];
  phase: ActivityPhase;
  summaryMessage: string;
  actionLabel: string;
  onFileClick: (path: string) => void;
  onDismiss: () => void;
}

export default function ActivityPanel({
  entries,
  phase,
  summaryMessage,
  actionLabel,
  onFileClick,
  onDismiss,
}: ActivityPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="px-2 py-1 border-b border-l flex items-center gap-1 shrink-0">
        <span className="px-2 py-0.5 text-[11px] font-semibold uppercase text-foreground">
          Activity
        </span>
        {actionLabel && (
          <span className="text-[11px] text-foreground-dim truncate">
            {actionLabel}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={onDismiss}
          title="Dismiss"
          className="h-6 w-6 flex items-center justify-center text-foreground-muted hover:text-foreground"
        >
          <span className="text-sm leading-none">&times;</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {phase === 'analyzing' && entries.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="flex items-center gap-2 text-[13px] text-foreground-muted">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              Analyzing...
            </span>
          </div>
        )}

        {(phase === 'active' || phase === 'done' || phase === 'error' || (phase === 'analyzing' && entries.length > 0)) && (
          <>
            {/* File list */}
            <div ref={listRef} className="flex-1 overflow-auto px-1 py-1">
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
                </div>
                {summaryMessage && (
                  <pre className="text-[11px] text-foreground-dim font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-auto">
                    {summaryMessage}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
