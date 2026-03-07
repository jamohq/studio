import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { SyncMode } from '../hooks/useSyncStatus';
import type { ChangedFile } from '../../shared/types';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  modified: { label: 'M', className: 'bg-yellow-500/20 text-yellow-400' },
  added: { label: 'A', className: 'bg-green-500/20 text-green-400' },
  deleted: { label: 'D', className: 'bg-red-500/20 text-red-400' },
  untracked: { label: '?', className: 'bg-blue-500/20 text-blue-400' },
  renamed: { label: 'R', className: 'bg-purple-500/20 text-purple-400' },
};

const MODE_BANNER: Record<string, { label: string; className: string }> = {
  creator_mode: {
    label: 'Creator Mode — review changes and commit',
    className: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  code_mode: {
    label: 'Code Mode — review changes and commit',
    className: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
};

const PREFILL_MESSAGES: Record<string, string> = {
  'generate-creator': 'Generate creator files from codebase',
  'update-creator': 'Update creator files to match codebase',
  'generate-code': 'Generate code from creator blueprints',
  'update-code': 'Update code to match creator blueprints',
};

interface ChangesPanelProps {
  workspaceId: string;
  syncMode: SyncMode;
  lastAction: string | null;
  onCommit: () => void;
}

export default function ChangesPanel({ workspaceId, syncMode, lastAction, onCommit }: ChangesPanelProps) {
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [isClean, setIsClean] = useState(true);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const pendingCommitRef = useRef(false);

  // Pre-fill commit message based on last action.
  useEffect(() => {
    if (lastAction && PREFILL_MESSAGES[lastAction]) {
      setCommitMsg(PREFILL_MESSAGES[lastAction]);
    }
  }, [lastAction]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure git is initialized before checking status.
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

  // Initial load + polling.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const viewDiff = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const res = await window.jamo.gitDiff(workspaceId, filePath);
      setDiffContent(res.diff);
    } catch (err) {
      console.error('Failed to get diff:', err);
      setDiffContent('Failed to load diff');
    }
  }, [workspaceId]);

  const doCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      await window.jamo.gitInit(workspaceId);
      await window.jamo.gitCommit(workspaceId, commitMsg.trim());
      setCommitMsg('');
      setSelectedFile(null);
      setDiffContent(null);
      onCommit();
      refresh();
    } catch (err: any) {
      console.error('Commit failed:', err);
      alert('Commit failed: ' + (err?.message || err));
    } finally {
      setCommitting(false);
    }
  }, [workspaceId, commitMsg, onCommit, refresh]);

  const handleCommitClick = useCallback(() => {
    if (syncMode === 'synced') {
      const hasCreatorChanges = files.some((f) => f.path.startsWith('.jamo/creator/'));
      if (hasCreatorChanges) {
        setShowSyncWarning(true);
        pendingCommitRef.current = true;
        return;
      }
    }
    doCommit();
  }, [syncMode, files, doCommit]);

  const handleWarningConfirm = useCallback(() => {
    setShowSyncWarning(false);
    if (pendingCommitRef.current) {
      pendingCommitRef.current = false;
      doCommit();
    }
  }, [doCommit]);

  const banner = MODE_BANNER[syncMode];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase text-foreground-muted flex items-center">
        Changes
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="opacity-50 hover:opacity-100 transition-opacity"
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Mode banner */}
      {banner && (
        <div className={cn('mx-2 mb-2 px-2.5 py-1.5 text-[11px] rounded border', banner.className)}>
          {banner.label}
        </div>
      )}

      {/* Commit section */}
      <div className="px-2 mb-2">
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message..."
          rows={3}
          className="w-full text-[11px] px-2 py-1.5 bg-background-deep border border-border rounded resize-none focus:outline-none focus:border-accent"
        />
        <Button
          onClick={handleCommitClick}
          disabled={committing || isClean || !commitMsg.trim()}
          size="sm"
          className="w-full text-[11px] font-semibold h-7 mt-1 bg-accent hover:bg-accent/90"
        >
          {committing ? 'Committing...' : 'Commit'}
        </Button>
      </div>

      {/* Changed files list */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {isClean ? (
          <div className="text-[11px] text-foreground-dim px-1 py-2">
            No changes
          </div>
        ) : (
          files.map((file) => {
            const badge = STATUS_BADGE[file.status] || STATUS_BADGE.modified;
            const isSelected = selectedFile === file.path;
            return (
              <button
                key={file.path}
                onClick={() => viewDiff(file.path)}
                className={cn(
                  'w-full flex items-center gap-1.5 px-1.5 py-1 text-left rounded text-[11px] hover:bg-accent-bg transition-colors',
                  isSelected && 'bg-accent-bg',
                )}
              >
                <span className={cn('px-1 rounded text-[10px] font-mono font-bold shrink-0', badge.className)}>
                  {badge.label}
                </span>
                <span className="truncate text-foreground-muted">{file.path}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Diff viewer */}
      {diffContent !== null && (
        <div className="border-t max-h-[40%] overflow-auto">
          <div className="flex items-center px-2 py-1 border-b">
            <span className="text-[10px] text-foreground-dim truncate flex-1">{selectedFile}</span>
            <button
              onClick={() => { setSelectedFile(null); setDiffContent(null); }}
              className="text-[10px] text-foreground-dim hover:text-foreground ml-2"
            >
              Close
            </button>
          </div>
          <pre className="text-[11px] font-mono p-2 leading-tight overflow-x-auto">
            {diffContent.split('\n').map((line, i) => {
              let cls = 'text-foreground-dim';
              if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-green-400';
              else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400';
              else if (line.startsWith('@@')) cls = 'text-blue-400';
              return (
                <div key={i} className={cls}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      )}

      {/* Sync warning dialog */}
      <AlertDialog open={showSyncWarning} onOpenChange={(open) => { if (!open) { setShowSyncWarning(false); pendingCommitRef.current = false; } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit without syncing?</AlertDialogTitle>
            <AlertDialogDescription>
              You're committing creator file changes without syncing code. Only do this if you're manually fixing AI output.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
