import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChangedFile } from '../../shared/types';

export type DerivedMode = 'synced' | 'design_changed' | 'code_changed' | 'mixed';

function classifyFile(path: string): 'design' | 'code' | 'other' {
  if (path.startsWith('.jamo/creator/')) return 'design';
  if (path.startsWith('.jamo/') || path === '.gitignore') return 'other';
  return 'code';
}

function deriveMode(files: ChangedFile[]): DerivedMode {
  let hasDesign = false;
  let hasCode = false;
  for (const f of files) {
    const kind = classifyFile(f.path);
    if (kind === 'design') hasDesign = true;
    if (kind === 'code') hasCode = true;
  }
  if (!hasDesign && !hasCode) return 'synced';
  if (hasDesign && !hasCode) return 'design_changed';
  if (!hasDesign && hasCode) return 'code_changed';
  return 'mixed';
}

const POLL_INTERVAL_MS = 5000;

export function useChangeTracking(workspaceId: string | null) {
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [isClean, setIsClean] = useState(true);
  const [loading, setLoading] = useState(false);
  const [actionRanSinceLastCommit, setActionRanSinceLastCommit] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      await window.jamo.gitInit(workspaceId);
      const res = await window.jamo.gitStatus(workspaceId);
      setFiles(res.files);
      setIsClean(res.isClean);
    } catch (err) {
      console.error('Failed to get git status:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const derivedMode = deriveMode(files);

  const markActionRan = useCallback(() => {
    setActionRanSinceLastCommit(true);
  }, []);

  const resetAfterCommit = useCallback(() => {
    setActionRanSinceLastCommit(false);
  }, []);

  return {
    files,
    isClean,
    loading,
    derivedMode,
    actionRanSinceLastCommit,
    markActionRan,
    resetAfterCommit,
    refresh,
  };
}
