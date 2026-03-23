import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChangedFile, GitLogEntry, CommitTag, CommitSource } from '../../shared/types';

export type TagFilter = CommitTag | 'all';
export type DerivedMode = 'synced' | 'design_changed' | 'code_changed' | 'mixed';

/** Files/dirs to hide from the source control view. */
const NOISE_PATTERNS = [
  '.jamo/runs/',
  '.jamo/.prompt',
  '.jamo/.run.sh',
  '.jamo/.exit_status',
  '.jamo/.output',
];

function isNoiseFile(path: string): boolean {
  return NOISE_PATTERNS.some((p) => path === p || path.startsWith(p));
}

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

function formatCommitMessage(tag: CommitTag, description: string, source: CommitSource): string {
  return `[${tag}] ${description}\n\njamo:tag=${tag}\njamo:source=${source}`;
}

const STATUS_POLL_MS = 5000;

export function useSourceControl(workspaceId: string | null) {
  const [stagedFiles, setStagedFiles] = useState<ChangedFile[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<ChangedFile[]>([]);
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [actionRanSinceLastCommit, setActionRanSinceLastCommit] = useState(false);

  // History state
  const [entries, setEntries] = useState<GitLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filter, setFilter] = useState<TagFilter>('all');
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Array<{ path: string; status: string }>>([]);
  const [expandedDiff, setExpandedDiff] = useState('');

  // Refresh status + branch (fast, every 5s)
  const refreshStatus = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      // Fetch status and branch independently so a branch failure doesn't block status updates
      const statusRes = await window.jamo.gitStatus(workspaceId);

      const filtered = statusRes.files.filter((f) => !isNoiseFile(f.path));

      const staged: ChangedFile[] = [];
      const unstaged: ChangedFile[] = [];

      for (const f of filtered) {
        if (f.indexStatus === 'staged') {
          staged.push(f);
        } else if (f.indexStatus === 'partially-staged') {
          staged.push(f);
          unstaged.push(f);
        } else {
          unstaged.push(f);
        }
      }

      setStagedFiles(staged);
      setUnstagedFiles(unstaged);

      // Branch is best-effort — don't let it block status updates
      try {
        const branchRes = await window.jamo.gitBranch(workspaceId);
        setBranch(branchRes.branch);
      } catch {
        // Keep previous branch value
      }
    } catch (err) {
      console.error('[SourceControl] Status refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Refresh history (heavier, on demand)
  const refreshHistory = useCallback(async () => {
    if (!workspaceId) return;
    setHistoryLoading(true);
    try {
      const res = await window.jamo.getCommitHistory(workspaceId, 100);
      setEntries(res.entries);
    } catch (err) {
      console.error('[SourceControl] History refresh failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [workspaceId]);

  // Combined refresh
  const refresh = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshHistory()]);
  }, [refreshStatus, refreshHistory]);

  // Poll status every 5s
  useEffect(() => {
    refreshStatus();
    refreshHistory();
    const interval = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshStatus, refreshHistory]);

  // Staging actions
  const stageFile = useCallback(async (filePath: string) => {
    if (!workspaceId) return;
    await window.jamo.gitAdd(workspaceId, [filePath]);
    await refreshStatus();
  }, [workspaceId, refreshStatus]);

  const unstageFile = useCallback(async (filePath: string) => {
    if (!workspaceId) return;
    await window.jamo.gitResetFiles(workspaceId, [filePath]);
    await refreshStatus();
  }, [workspaceId, refreshStatus]);

  const stageAll = useCallback(async () => {
    if (!workspaceId || unstagedFiles.length === 0) return;
    await window.jamo.gitAdd(workspaceId, unstagedFiles.map((f) => f.path));
    await refreshStatus();
  }, [workspaceId, unstagedFiles, refreshStatus]);

  const unstageAll = useCallback(async () => {
    if (!workspaceId || stagedFiles.length === 0) return;
    await window.jamo.gitResetFiles(workspaceId, stagedFiles.map((f) => f.path));
    await refreshStatus();
  }, [workspaceId, stagedFiles, refreshStatus]);

  // Revert (discard changes)
  const revertFile = useCallback(async (filePath: string) => {
    if (!workspaceId) return;
    await window.jamo.gitCheckout(workspaceId, [filePath]);
    await refreshStatus();
  }, [workspaceId, refreshStatus]);

  // Commit staged files
  const commit = useCallback(async (message: string) => {
    if (!workspaceId || !message.trim()) return;
    const tag = 'manual-code' as CommitTag;
    const formatted = formatCommitMessage(tag, message.trim(), 'manual');
    await window.jamo.gitCommitStaged(workspaceId, formatted);
    setActionRanSinceLastCommit(false);
    await refresh();
  }, [workspaceId, refresh]);

  // History: expand/collapse commit
  const toggleExpand = useCallback(async (hash: string) => {
    if (expandedHash === hash) {
      setExpandedHash(null);
      setExpandedFiles([]);
      setExpandedDiff('');
      return;
    }

    setExpandedHash(hash);
    if (!workspaceId) return;

    try {
      const result = await window.jamo.gitDiffCommits(workspaceId, `${hash}~1`, hash);
      setExpandedFiles(result.files);
      setExpandedDiff(result.diff);
    } catch {
      setExpandedFiles([]);
      setExpandedDiff('');
    }
  }, [workspaceId, expandedHash]);

  // History: restore to commit
  const restore = useCallback(async (commitHash: string) => {
    if (!workspaceId) return;
    await window.jamo.gitRevertTo(workspaceId, commitHash);
    await refresh();
  }, [workspaceId, refresh]);

  // Filtered entries
  const filteredEntries = filter === 'all'
    ? entries
    : entries.filter((e) => e.meta?.tag === filter);

  // Derived mode for sync warnings
  const allFiles = [...stagedFiles, ...unstagedFiles];
  const derivedMode = deriveMode(allFiles);
  const isClean = stagedFiles.length === 0 && unstagedFiles.length === 0;

  const markActionRan = useCallback(() => {
    setActionRanSinceLastCommit(true);
  }, []);

  return {
    // Working tree
    stagedFiles,
    unstagedFiles,
    branch,
    isClean,
    loading,
    derivedMode,
    actionRanSinceLastCommit,

    // Actions
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    revertFile,
    commit,
    markActionRan,

    // History
    entries: filteredEntries,
    allEntries: entries,
    historyLoading,
    filter,
    setFilter,
    expandedHash,
    expandedFiles,
    expandedDiff,
    toggleExpand,
    restore,

    // Refresh
    refresh,
    refreshStatus,
    refreshHistory,
  };
}
