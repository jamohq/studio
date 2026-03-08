import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActionStatus } from './useActionRunner';
import type { ChangedFile } from '../../shared/types';

export interface ActivityEntry {
  path: string;
  status: string;
  isDir: boolean;
  detectedAt: number;
}

export type ActivityPhase = 'idle' | 'analyzing' | 'active' | 'done' | 'error';

const POLL_MS = 1000;

/** Recursively list all files under a directory path. */
async function expandDir(workspaceId: string, dirPath: string): Promise<string[]> {
  try {
    const res = await window.jamo.listDirectory(workspaceId, dirPath);
    const paths: string[] = [];
    for (const entry of res.entries) {
      if (entry.name.startsWith('.')) continue;
      const full = dirPath ? `${dirPath}/${entry.name}` : entry.name;
      if (entry.isDir) {
        paths.push(...await expandDir(workspaceId, full));
      } else {
        paths.push(full);
      }
    }
    return paths;
  } catch {
    return [];
  }
}

export function useActivityFeed(
  workspaceId: string | null,
  actionStatus: ActionStatus,
  actionLabel: string,
) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [phase, setPhase] = useState<ActivityPhase>('idle');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const baselineRef = useRef<Map<string, string>>(new Map());
  const prevActionStatus = useRef<ActionStatus>('idle');

  // Snapshot baseline and start tracking when action begins.
  useEffect(() => {
    const prev = prevActionStatus.current;
    prevActionStatus.current = actionStatus;

    if (prev !== 'running' && actionStatus === 'running' && workspaceId) {
      // Take baseline snapshot.
      setEntries([]);
      setSummaryMessage('');
      setPhase('analyzing');
      setVisible(true);

      window.jamo.gitStatus(workspaceId).then((res) => {
        const map = new Map<string, string>();
        for (const f of res.files) {
          map.set(f.path, f.status);
        }
        baselineRef.current = map;
      }).catch(() => {
        baselineRef.current = new Map();
      });
    }
  }, [actionStatus, workspaceId]);

  // Poll for changes while running.
  useEffect(() => {
    if (actionStatus !== 'running' || !workspaceId) return;

    const interval = setInterval(async () => {
      try {
        const res = await window.jamo.gitStatus(workspaceId);
        const baseline = baselineRef.current;
        const newEntries: ActivityEntry[] = [];
        const now = Date.now();

        for (const file of res.files) {
          if (file.path.startsWith('.jamo/')) continue;
          const baselineStatus = baseline.get(file.path);
          if (baselineStatus !== file.status) {
            // Git reports untracked directories as "dir/" — expand into individual files.
            if (file.path.endsWith('/')) {
              const dirPath = file.path.slice(0, -1);
              const childPaths = await expandDir(workspaceId, dirPath);
              for (const cp of childPaths) {
                newEntries.push({ path: cp, status: file.status, isDir: false, detectedAt: now });
              }
            } else {
              newEntries.push({ path: file.path, status: file.status, isDir: false, detectedAt: now });
            }
          }
        }

        if (newEntries.length > 0) {
          // Remove directory entries that are parents of other entries
          // (e.g. drop "src/" if "src/App.tsx" exists).
          const allPaths = new Set(newEntries.map((e) => e.path));
          const filtered = newEntries.filter((e) => {
            const dir = e.path.endsWith('/') ? e.path : e.path + '/';
            for (const p of allPaths) {
              if (p !== e.path && p.startsWith(dir)) return false;
            }
            return true;
          });

          setEntries((prev) => {
            const prevPaths = new Set(prev.map((e) => e.path));
            // Also drop any directory entry if an existing entry is nested under it
            const additions = filtered.filter((e) => {
              if (prevPaths.has(e.path)) return false;
              const dir = e.path.endsWith('/') ? e.path : e.path + '/';
              for (const p of prevPaths) {
                if (p.startsWith(dir)) return false;
              }
              return true;
            });
            // Drop any existing directory entries that are parents of new additions
            const newPaths = new Set(additions.map((e) => e.path));
            const cleaned = prev.filter((e) => {
              const dir = e.path.endsWith('/') ? e.path : e.path + '/';
              for (const p of newPaths) {
                if (p.startsWith(dir)) return false;
              }
              return true;
            });
            return additions.length > 0 || cleaned.length < prev.length
              ? [...cleaned, ...additions]
              : prev;
          });
          setPhase('active');
        }
      } catch {
        // Ignore polling errors.
      }
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [actionStatus, workspaceId]);

  // Read summary when action completes.
  useEffect(() => {
    if ((actionStatus === 'done' || actionStatus === 'error') && phase !== 'idle' && workspaceId) {
      setPhase(actionStatus === 'done' ? 'done' : 'error');

      window.jamo.listDirectory(workspaceId, '.jamo').then((dir) => {
        if (!dir.entries.some((e) => e.name === '.output')) {
          setSummaryMessage('');
          return;
        }
        return window.jamo.readFile(workspaceId, '.jamo/.output').then((res) => {
          setSummaryMessage(res.content.trim());
        });
      }).catch(() => {
        setSummaryMessage('');
      });
    }
  }, [actionStatus, workspaceId, phase]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setPhase('idle');
    setEntries([]);
    setSummaryMessage('');
  }, []);

  return { entries, phase, summaryMessage, visible, dismiss };
}
