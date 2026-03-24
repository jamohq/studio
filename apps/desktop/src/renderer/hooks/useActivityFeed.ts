import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActionStatus } from './useActionRunner';

export interface ActivityEntry {
  path: string;
  status: string;
  isDir: boolean;
  detectedAt: number;
}

export type ActivityPhase = 'idle' | 'analyzing' | 'active' | 'done' | 'error';

export function useActivityFeed(
  workspaceId: string | null,
  actionStatus: ActionStatus,
  actionLabel: string,
  actionFileChanges: string[],
) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [phase, setPhase] = useState<ActivityPhase>('idle');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const prevActionStatus = useRef<ActionStatus>('idle');

  // Track action lifecycle.
  useEffect(() => {
    const prev = prevActionStatus.current;
    prevActionStatus.current = actionStatus;

    // Handle cancel: running → idle means action was cancelled.
    if (prev === 'running' && actionStatus === 'idle') {
      setPhase('idle');
      setVisible(false);
      setElapsedSeconds(0);
    }

    if (prev !== 'running' && actionStatus === 'running') {
      setEntries([]);
      setSummaryMessage('');
      setElapsedSeconds(0);
      setPhase('analyzing');
      setVisible(true);
    }
  }, [actionStatus]);

  // Elapsed time counter while action is running.
  useEffect(() => {
    if (actionStatus !== 'running') return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [actionStatus]);

  // Sync file changes from the action runner's streaming events into entries.
  useEffect(() => {
    if (actionFileChanges.length === 0) return;

    const now = Date.now();
    setEntries((prev) => {
      const prevPaths = new Set(prev.map((e) => e.path));
      const additions = actionFileChanges
        .filter((p) => !prevPaths.has(p))
        .map((p) => ({ path: p, status: 'modified', isDir: false, detectedAt: now }));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
    if (phase === 'analyzing') {
      setPhase('active');
    }
  }, [actionFileChanges, phase]);

  // Handle completion.
  useEffect(() => {
    if ((actionStatus === 'done' || actionStatus === 'error') && phase !== 'idle' && workspaceId) {
      setPhase(actionStatus === 'done' ? 'done' : 'error');
    }
  }, [actionStatus, workspaceId, phase]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setPhase('idle');
    setEntries([]);
    setSummaryMessage('');
    setElapsedSeconds(0);
  }, []);

  return { entries, phase, summaryMessage, elapsedSeconds, visible, dismiss };
}
