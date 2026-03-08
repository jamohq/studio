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
import { useToast } from './Toast';
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
    label: 'Designing — review changes and save',
    className: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  code_mode: {
    label: 'Building — review changes and save',
    className: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
};

const PREFILL_MESSAGES: Record<string, string> = {
  'generate-creator': 'Generate designs from codebase',
  'update-creator': 'Update designs to match codebase',
  'generate-code': 'Generate code from designs',
  'update-code': 'Update code to match designs',
};

interface ChangesPanelProps {
  workspaceId: string;
  syncMode: SyncMode;
  lastAction: string | null;
  onCommit: () => void;
}

export default function ChangesPanel({ workspaceId, syncMode, lastAction, onCommit }: ChangesPanelProps) {
  const { toast } = useToast();
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
      toast({ title: 'Save failed', description: err?.message || String(err), variant: 'error' });
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
      {/* Top bar: mode banner + commit controls */}
      <div className="shrink-0 border-b px-4 py-3">
        {banner && (
          <div className={cn('mb-3 px-3 py-2 text-[12px] rounded border', banner.className)}>
            {banner.label}
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Save message..."
            className="flex-1 text-[13px] px-3 py-1.5 bg-background-deep border border-border rounded focus:outline-none focus:border-accent"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommitClick(); } }}
          />
          <Button
            onClick={handleCommitClick}
            disabled={committing || isClean || !commitMsg.trim()}
            size="sm"
            className="text-[13px] font-semibold h-8 px-6 bg-accent hover:bg-accent/90"
          >
            {committing ? 'Saving...' : 'Save'}
          </Button>
          <button
            onClick={refresh}
            className="opacity-50 hover:opacity-100 transition-opacity p-1"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Main content: file list + diff viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* File list */}
        <div className="w-72 shrink-0 border-r overflow-auto">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase text-foreground-muted">
            Changed Files {!isClean && <span className="text-foreground-dim">({files.length})</span>}
          </div>
          {isClean ? (
            <div className="text-[12px] text-foreground-dim px-3 py-2">
              No changes
            </div>
          ) : (
            <div className="px-1">
              {files.map((file) => {
                const badge = STATUS_BADGE[file.status] || STATUS_BADGE.modified;
                const isSelected = selectedFile === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => viewDiff(file.path)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-left rounded text-[12px] hover:bg-accent-bg transition-colors',
                      isSelected && 'bg-accent-bg',
                    )}
                  >
                    <span className={cn('px-1 rounded text-[10px] font-mono font-bold shrink-0', badge.className)}>
                      {badge.label}
                    </span>
                    <span className="truncate text-foreground-muted">{file.path}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Diff viewer */}
        <div className="flex-1 overflow-auto">
          {diffContent !== null ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center px-4 py-2 border-b shrink-0">
                <span className="text-[12px] text-foreground-muted truncate flex-1 font-mono">{selectedFile}</span>
                <button
                  onClick={() => { setSelectedFile(null); setDiffContent(null); }}
                  className="text-[11px] text-foreground-dim hover:text-foreground ml-2"
                >
                  Close
                </button>
              </div>
              <pre className="flex-1 text-[13px] font-mono p-4 leading-relaxed overflow-auto">
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
          ) : (
            <div className="flex items-center justify-center h-full text-foreground-dim text-[13px]">
              {isClean ? 'Working tree clean' : 'Select a file to view its diff'}
            </div>
          )}
        </div>
      </div>

      {/* Sync warning dialog */}
      <AlertDialog open={showSyncWarning} onOpenChange={(open) => { if (!open) { setShowSyncWarning(false); pendingCommitRef.current = false; } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save without syncing?</AlertDialogTitle>
            <AlertDialogDescription>
              You're saving design changes without updating code. Only do this if you're manually fixing AI output.
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
