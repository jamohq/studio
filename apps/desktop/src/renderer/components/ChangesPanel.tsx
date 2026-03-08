import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { RefreshCw, Undo2 } from 'lucide-react';
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
import type { DerivedMode } from '../hooks/useChangeTracking';
import type { ChangedFile } from '../../shared/types';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  modified: { label: 'M', className: 'bg-yellow-500/20 text-yellow-400' },
  added: { label: 'A', className: 'bg-green-500/20 text-green-400' },
  deleted: { label: 'D', className: 'bg-red-500/20 text-red-400' },
  untracked: { label: '?', className: 'bg-blue-500/20 text-blue-400' },
  renamed: { label: 'R', className: 'bg-purple-500/20 text-purple-400' },
};

const SYNC_WARNINGS: Record<string, string> = {
  design_changed: "Design changes haven't been reflected in code. Continue only if the code already has this info.",
  code_changed: "Code changes haven't been reflected in designs. Continue only if the designs already have this info.",
  mixed: 'Both design and code changed without syncing.',
};

interface ChangesPanelProps {
  workspaceId: string;
  files: ChangedFile[];
  isClean: boolean;
  loading: boolean;
  derivedMode: DerivedMode;
  actionRanSinceLastCommit: boolean;
  onCommit: () => void;
  onRefresh: () => void;
}

export default function ChangesPanel({ workspaceId, files, isClean, loading, derivedMode, actionRanSinceLastCommit, onCommit, onRefresh }: ChangesPanelProps) {
  const { toast } = useToast();
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const pendingCommitRef = useRef(false);
  const [revertTarget, setRevertTarget] = useState<{ label: string; paths: string[] } | null>(null);

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
      onRefresh();
    } catch (err: any) {
      console.error('Commit failed:', err);
      toast({ title: 'Save failed', description: err?.message || String(err), variant: 'error' });
    } finally {
      setCommitting(false);
    }
  }, [workspaceId, commitMsg, onCommit, onRefresh]);

  const handleCommitClick = useCallback(() => {
    // If an action ran successfully since last commit, no warning needed.
    if (actionRanSinceLastCommit) {
      doCommit();
      return;
    }

    // Warn if there are unsynced changes.
    const warning = SYNC_WARNINGS[derivedMode];
    if (warning) {
      setShowSyncWarning(true);
      pendingCommitRef.current = true;
      return;
    }

    doCommit();
  }, [actionRanSinceLastCommit, derivedMode, doCommit]);

  const handleWarningConfirm = useCallback(() => {
    setShowSyncWarning(false);
    if (pendingCommitRef.current) {
      pendingCommitRef.current = false;
      doCommit();
    }
  }, [doCommit]);

  // Group files by top-level folder for folder-level revert.
  const folderGroups = useMemo(() => {
    const groups = new Map<string, ChangedFile[]>();
    for (const file of files) {
      const slash = file.path.indexOf('/');
      const folder = slash > 0 ? file.path.slice(0, slash) : '.';
      const arr = groups.get(folder) || [];
      arr.push(file);
      groups.set(folder, arr);
    }
    return groups;
  }, [files]);

  const handleRevertConfirm = useCallback(async () => {
    if (!revertTarget) return;
    try {
      await window.jamo.gitCheckout(workspaceId, revertTarget.paths.length > 0 ? revertTarget.paths : undefined);
      toast({ title: 'Reverted', description: `Discarded changes to ${revertTarget.label}`, variant: 'success' });
      setRevertTarget(null);
      setSelectedFile(null);
      setDiffContent(null);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Revert failed', description: err?.message || String(err), variant: 'error' });
      setRevertTarget(null);
    }
  }, [workspaceId, revertTarget, onRefresh, toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: commit controls */}
      <div className="shrink-0 border-b px-4 py-3">
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
            onClick={onRefresh}
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
          <div className="px-3 py-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-foreground-muted flex-1">
              Changed Files {!isClean && <span className="text-foreground-dim">({files.length})</span>}
            </span>
            {!isClean && (
              <button
                onClick={() => setRevertTarget({ label: 'all files', paths: [] })}
                title="Revert all changes"
                className="text-foreground-dim hover:text-destructive transition-colors p-0.5"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {isClean ? (
            <div className="text-[12px] text-foreground-dim px-3 py-2">
              No changes
            </div>
          ) : (
            <div className="px-1">
              {[...folderGroups.entries()].map(([folder, folderFiles]) => (
                <React.Fragment key={folder}>
                  {/* Folder header (only if there are multiple folders) */}
                  {folderGroups.size > 1 && (
                    <div className="flex items-center gap-1 px-2 py-1 mt-1">
                      <span className="text-[10px] font-semibold text-foreground-dim uppercase truncate flex-1">
                        {folder === '.' ? 'Root' : folder}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevertTarget({ label: folder === '.' ? 'root files' : `${folder}/`, paths: folderFiles.map((f) => f.path) });
                        }}
                        title={`Revert all changes in ${folder}`}
                        className="text-foreground-dim hover:text-destructive transition-colors p-0.5"
                      >
                        <Undo2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {folderFiles.map((file) => {
                    const badge = STATUS_BADGE[file.status] || STATUS_BADGE.modified;
                    const isSelected = selectedFile === file.path;
                    return (
                      <div
                        key={file.path}
                        className={cn(
                          'group flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-accent-bg transition-colors cursor-pointer',
                          isSelected && 'bg-accent-bg',
                        )}
                      >
                        <button
                          onClick={() => viewDiff(file.path)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          <span className={cn('px-1 rounded text-[10px] font-mono font-bold shrink-0', badge.className)}>
                            {badge.label}
                          </span>
                          <span className="truncate text-foreground-muted">{file.path}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRevertTarget({ label: file.path, paths: [file.path] });
                          }}
                          title={`Revert ${file.path}`}
                          className="text-foreground-dim hover:text-destructive transition-colors p-0.5 opacity-0 group-hover:opacity-100"
                        >
                          <Undo2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
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
              {SYNC_WARNINGS[derivedMode] || 'You have unsynced changes.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningConfirm}>
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert confirmation dialog */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all unsaved changes to <strong>{revertTarget?.label}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertConfirm} className="bg-destructive hover:bg-destructive/90">
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
