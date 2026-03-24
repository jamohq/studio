import React from 'react';
import { cn } from '@/lib/utils';
import type { TaskItem } from '../../shared/types';

interface TaskListProps {
  tasks: TaskItem[];
}

export default function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const visible = tasks.filter((t) => t.status !== 'deleted');

  return (
    <div className="rounded-md border border-accent/10 bg-accent/5 px-3 py-2">
      <div className="text-[11px] text-foreground-dim mb-1.5">
        {completed}/{visible.length} tasks
      </div>
      <div className="space-y-1">
        {visible.map((task) => (
          <div key={task.id} className="flex items-start gap-2 text-[12px]">
            {task.status === 'completed' ? (
              <span className="shrink-0 mt-0.5 h-3.5 w-3.5 rounded border border-green-500/50 bg-green-500/20 flex items-center justify-center text-green-400 text-[9px]">
                ✓
              </span>
            ) : task.status === 'in_progress' ? (
              <span className="shrink-0 mt-0.5 h-3.5 w-3.5 rounded border border-accent/50 bg-accent/20 flex items-center justify-center">
                <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
              </span>
            ) : (
              <span className="shrink-0 mt-0.5 h-3.5 w-3.5 rounded border border-foreground-dim/30" />
            )}
            <span className={cn(
              'leading-tight',
              task.status === 'completed'
                ? 'line-through text-foreground-dim/50'
                : task.status === 'in_progress'
                  ? 'text-foreground-muted'
                  : 'text-foreground-dim',
            )}>
              {task.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
