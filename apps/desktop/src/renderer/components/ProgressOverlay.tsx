import React, { useEffect, useState, useRef } from 'react';
import { Button } from './ui/button';

interface ProgressOverlayProps {
  visible: boolean;
  label: string;
  onShowDetails: () => void;
  status: 'running' | 'done' | 'error' | 'idle';
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ProgressOverlay({ visible, label, onShowDetails, status }: ProgressOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset and manage the elapsed timer based on status.
  useEffect(() => {
    if (status === 'running') {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background">
      {status === 'running' && (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          {/* Animated spinner */}
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-[3px] border-border border-t-accent animate-spin" />
          </div>

          {/* Label */}
          <div className="text-sm font-medium text-foreground">
            {label || 'Working on it\u2026'}
          </div>

          {/* Elapsed time */}
          <div className="text-xs text-foreground-muted tabular-nums">
            {formatElapsed(elapsed)}
          </div>

          {/* Show Details */}
          <Button
            variant="outline"
            size="sm"
            onClick={onShowDetails}
            className="mt-2 text-[11px] text-foreground-muted hover:text-foreground"
          >
            Show Details
          </Button>
        </div>
      )}

      {status === 'done' && (
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          {/* Success icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success/15">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-success">
              <path
                d="M6 10.5L9 13.5L14 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="text-sm font-medium text-foreground">Done</div>
          <div className="text-xs text-foreground-muted">
            Completed in {formatElapsed(elapsed)}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onShowDetails}
            className="mt-1 text-[11px] text-foreground-muted hover:text-foreground"
          >
            Show Details
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          {/* Error icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-destructive">
              <path
                d="M7 7L13 13M13 7L7 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="text-sm font-medium text-destructive">Something went wrong</div>
          <div className="text-xs text-foreground-muted">
            Check the terminal output for details.
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onShowDetails}
            className="mt-1 text-[11px] text-foreground-muted hover:text-foreground"
          >
            Show Details
          </Button>
        </div>
      )}
    </div>
  );
}
