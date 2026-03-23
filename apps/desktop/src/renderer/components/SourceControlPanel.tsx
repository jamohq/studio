import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Minus, Undo2, RefreshCw } from 'lucide-react';
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
import type { ChangedFile, CommitTag, GitLogEntry } from '../../shared/types';
import type { TagFilter, DerivedMode } from '../hooks/useSourceControl';

// --- Constants ---

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  modified: { label: 'M', className: 'bg-yellow-500/20 text-yellow-400' },
  added: { label: 'A', className: 'bg-green-500/20 text-green-400' },
  deleted: { label: 'D', className: 'bg-red-500/20 text-red-400' },
  untracked: { label: '?', className: 'bg-blue-500/20 text-blue-400' },
  renamed: { label: 'R', className: 'bg-purple-500/20 text-purple-400' },
};

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'auto-code': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'auto-design': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'manual-code': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'manual-design': { bg: 'bg-teal-500/20', text: 'text-teal-400' },
  'chat-log': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

const DEFAULT_TAG_COLOR = { bg: 'bg-neutral-500/20', text: 'text-foreground-dim' };

const FILTER_OPTIONS: Array<{ value: TagFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'auto-code', label: 'Auto Code' },
  { value: 'auto-design', label: 'Auto Design' },
  { value: 'manual-code', label: 'Manual Code' },
  { value: 'manual-design', label: 'Manual Design' },
  { value: 'chat-log', label: 'Chat Log' },
];

const SYNC_WARNINGS: Record<string, string> = {
  design_changed: "Design changes haven't been reflected in code.",
  code_changed: "Code changes haven't been reflected in designs.",
  mixed: 'Both design and code changed without syncing.',
};

// --- Helpers ---

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 172800_000) return 'yesterday';
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function TagBadge({ tag }: { tag?: CommitTag }) {
  const colors = tag ? (TAG_COLORS[tag] || DEFAULT_TAG_COLOR) : DEFAULT_TAG_COLOR;
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-bold', colors.bg, colors.text)}>
      {tag || 'untagged'}
    </span>
  );
}

// --- File row ---

interface FileRowProps {
  file: ChangedFile;
  selected: boolean;
  onClick: () => void;
  actions: React.ReactNode;
}

function FileRow({ file, selected, onClick, actions }: FileRowProps) {
  const badge = STATUS_BADGE[file.status] || STATUS_BADGE.modified;
  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-2 py-1 rounded text-[12px] hover:bg-accent-bg transition-colors cursor-pointer',
        selected && 'bg-accent-bg',
      )}
    >
      <button onClick={onClick} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
        <span className={cn('px-1 rounded text-[10px] font-mono font-bold shrink-0', badge.className)}>
          {badge.label}
        </span>
        <span className="truncate text-foreground-muted">{file.path}</span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {actions}
      </div>
    </div>
  );
}

function IconButton({ onClick, title, children, className }: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      title={title}
      className={cn('p-0.5 rounded hover:bg-background-deep transition-colors', className)}
    >
      {children}
    </button>
  );
}

// --- Section header ---

function SectionHeader({ label, count, children, collapsed, onToggle }: {
  label: string;
  count: number;
  children?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <button onClick={onToggle} className="flex items-center gap-1 flex-1 min-w-0 text-left">
        <span className="text-[10px] text-foreground-dim">{collapsed ? '▸' : '▾'}</span>
        <span className="text-[11px] font-semibold uppercase text-foreground-muted">
          {label}
        </span>
        {count > 0 && (
          <span className="text-[10px] text-foreground-dim">({count})</span>
        )}
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        {children}
      </div>
    </div>
  );
}

// --- Props ---

interface SourceControlPanelProps {
  workspaceId: string;
  // Working tree
  stagedFiles: ChangedFile[];
  unstagedFiles: ChangedFile[];
  branch: string;
  isClean: boolean;
  loading: boolean;
  derivedMode: DerivedMode;
  actionRanSinceLastCommit: boolean;
  // Actions
  onStageFile: (path: string) => Promise<void>;
  onUnstageFile: (path: string) => Promise<void>;
  onStageAll: () => Promise<void>;
  onUnstageAll: () => Promise<void>;
  onRevertFile: (path: string) => Promise<void>;
  onCommit: (message: string) => Promise<void>;
  onRefresh: () => void;
  // History
  entries: GitLogEntry[];
  historyLoading: boolean;
  filter: TagFilter;
  onFilterChange: (filter: TagFilter) => void;
  expandedHash: string | null;
  expandedFiles: Array<{ path: string; status: string }>;
  expandedDiff: string;
  onToggleExpand: (hash: string) => void;
  onRestore: (hash: string) => Promise<void>;
  // File click
  onFileClick: (path: string) => void;
}

export default function SourceControlPanel({
  workspaceId,
  stagedFiles,
  unstagedFiles,
  branch,
  isClean,
  loading,
  derivedMode,
  actionRanSinceLastCommit,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onRevertFile,
  onCommit,
  onRefresh,
  entries,
  historyLoading,
  filter,
  onFilterChange,
  expandedHash,
  expandedFiles,
  expandedDiff,
  onToggleExpand,
  onRestore,
  onFileClick,
}: SourceControlPanelProps) {
  const { toast } = useToast();
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [diffSource, setDiffSource] = useState<'staged' | 'unstaged' | 'commit'>('unstaged');
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [revertTarget, setRevertTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<GitLogEntry | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Section collapse state
  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [unstagedCollapsed, setUnstagedCollapsed] = useState(false);
  const [commitsCollapsed, setCommitsCollapsed] = useState(false);

  // View diff for a file
  const viewDiff = useCallback(async (filePath: string, source: 'staged' | 'unstaged') => {
    setSelectedFile(filePath);
    setDiffSource(source);
    try {
      const res = source === 'staged'
        ? await window.jamo.gitDiffStaged(workspaceId, filePath)
        : await window.jamo.gitDiff(workspaceId, filePath);
      setDiffContent(res.diff);
    } catch (err) {
      console.error('[SourceControl] Diff failed:', err);
      setDiffContent('Failed to load diff');
    }
  }, [workspaceId]);

  // View diff for a commit file
  const viewCommitDiff = useCallback((diff: string, filePath: string) => {
    setSelectedFile(filePath);
    setDiffSource('commit');
    setDiffContent(diff);
  }, []);

  // Commit
  const doCommit = useCallback(async () => {
    if (!commitMsg.trim() || stagedFiles.length === 0) return;
    setCommitting(true);
    try {
      await onCommit(commitMsg.trim());
      setCommitMsg('');
      setSelectedFile(null);
      setDiffContent(null);
      toast({ title: 'Committed', description: commitMsg.trim().slice(0, 60), variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Commit failed', description: err?.message || String(err), variant: 'error' });
    } finally {
      setCommitting(false);
    }
  }, [commitMsg, stagedFiles.length, onCommit, toast]);

  const handleCommitClick = useCallback(() => {
    if (actionRanSinceLastCommit) {
      doCommit();
      return;
    }
    const warning = SYNC_WARNINGS[derivedMode];
    if (warning) {
      setShowSyncWarning(true);
      return;
    }
    doCommit();
  }, [actionRanSinceLastCommit, derivedMode, doCommit]);

  // Revert
  const handleRevertConfirm = useCallback(async () => {
    if (!revertTarget) return;
    try {
      await onRevertFile(revertTarget);
      toast({ title: 'Reverted', description: `Discarded changes to ${revertTarget}`, variant: 'success' });
      setRevertTarget(null);
      if (selectedFile === revertTarget) {
        setSelectedFile(null);
        setDiffContent(null);
      }
    } catch (err: any) {
      toast({ title: 'Revert failed', description: err?.message || String(err), variant: 'error' });
      setRevertTarget(null);
    }
  }, [revertTarget, onRevertFile, selectedFile, toast]);

  // Restore to commit
  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await onRestore(restoreTarget.hash);
      toast({ title: 'Restored', description: `Reverted to: ${restoreTarget.message.split('\n')[0].slice(0, 60)}`, variant: 'success' });
      setRestoreTarget(null);
    } catch (err: any) {
      toast({ title: 'Restore failed', description: err?.message || String(err), variant: 'error' });
    } finally {
      setRestoring(false);
    }
  }, [restoreTarget, onRestore, toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-foreground">Source Control</span>
        <span className="text-[11px] text-foreground-dim font-mono">{branch}</span>
        <div className="flex-1" />
        <button
          onClick={onRefresh}
          className="opacity-50 hover:opacity-100 transition-opacity p-1"
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: file list + commits */}
        <div className="w-72 shrink-0 border-r overflow-auto flex flex-col">
          {/* Commit input */}
          <div className="shrink-0 border-b px-2 py-2">
            <div className="flex gap-1.5">
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message..."
                className="flex-1 text-[12px] px-2 py-1.5 bg-background-deep border border-border rounded focus:outline-none focus:border-accent min-w-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommitClick();
                  }
                }}
              />
              <Button
                onClick={handleCommitClick}
                disabled={committing || stagedFiles.length === 0 || !commitMsg.trim()}
                size="sm"
                className="text-[11px] font-semibold h-7 px-3 bg-accent hover:bg-accent/90 shrink-0"
              >
                {committing ? '...' : 'Commit'}
              </Button>
            </div>
          </div>

          {/* Staged files */}
          <div className="border-b">
            <SectionHeader
              label="Staged"
              count={stagedFiles.length}
              collapsed={stagedCollapsed}
              onToggle={() => setStagedCollapsed(!stagedCollapsed)}
            >
              {stagedFiles.length > 0 && (
                <IconButton onClick={() => onUnstageAll()} title="Unstage all">
                  <Minus className="h-3 w-3 text-foreground-dim" />
                </IconButton>
              )}
            </SectionHeader>
            {!stagedCollapsed && (
              <div className="px-1 pb-1">
                {stagedFiles.length === 0 ? (
                  <div className="text-[11px] text-foreground-dim px-2 py-1">No staged changes</div>
                ) : (
                  stagedFiles.map((file) => (
                    <FileRow
                      key={`staged-${file.path}`}
                      file={file}
                      selected={selectedFile === file.path && diffSource === 'staged'}
                      onClick={() => viewDiff(file.path, 'staged')}
                      actions={
                        <IconButton onClick={() => onUnstageFile(file.path)} title="Unstage">
                          <Minus className="h-3 w-3 text-foreground-dim" />
                        </IconButton>
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Unstaged files */}
          <div className="border-b">
            <SectionHeader
              label="Changes"
              count={unstagedFiles.length}
              collapsed={unstagedCollapsed}
              onToggle={() => setUnstagedCollapsed(!unstagedCollapsed)}
            >
              {unstagedFiles.length > 0 && (
                <IconButton onClick={() => onStageAll()} title="Stage all">
                  <Plus className="h-3 w-3 text-foreground-dim" />
                </IconButton>
              )}
            </SectionHeader>
            {!unstagedCollapsed && (
              <div className="px-1 pb-1">
                {unstagedFiles.length === 0 ? (
                  <div className="text-[11px] text-foreground-dim px-2 py-1">No changes</div>
                ) : (
                  unstagedFiles.map((file) => (
                    <FileRow
                      key={`unstaged-${file.path}`}
                      file={file}
                      selected={selectedFile === file.path && diffSource === 'unstaged'}
                      onClick={() => viewDiff(file.path, 'unstaged')}
                      actions={
                        <>
                          <IconButton onClick={() => onStageFile(file.path)} title="Stage">
                            <Plus className="h-3 w-3 text-foreground-dim" />
                          </IconButton>
                          {file.status !== 'untracked' && (
                            <IconButton
                              onClick={() => setRevertTarget(file.path)}
                              title="Discard changes"
                              className="hover:text-destructive"
                            >
                              <Undo2 className="h-3 w-3 text-foreground-dim" />
                            </IconButton>
                          )}
                        </>
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Commit log */}
          <div className="flex-1 overflow-auto">
            <SectionHeader
              label="Commits"
              count={entries.length}
              collapsed={commitsCollapsed}
              onToggle={() => setCommitsCollapsed(!commitsCollapsed)}
            >
              <select
                value={filter}
                onChange={(e) => onFilterChange(e.target.value as TagFilter)}
                className="bg-background-deep border border-border rounded text-[10px] px-1 py-0.5 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SectionHeader>
            {!commitsCollapsed && (
              <div className="px-1 pb-2 space-y-0.5">
                {entries.length === 0 && (
                  <div className="text-[11px] text-foreground-dim px-2 py-1">
                    {historyLoading ? 'Loading...' : 'No commits'}
                  </div>
                )}
                {entries.map((entry) => {
                  const isExpanded = expandedHash === entry.hash;
                  const title = entry.message.split('\n')[0];
                  return (
                    <div key={entry.hash} className="rounded border border-border/30">
                      <div className="px-2 py-1.5">
                        <div className="flex items-start gap-1.5">
                          <div className="pt-0.5 shrink-0">
                            <TagBadge tag={entry.meta?.tag} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-foreground truncate">{title}</div>
                            <div className="text-[10px] text-foreground-dim">
                              {entry.shortHash} · {relativeTime(entry.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => onToggleExpand(entry.hash)}
                            className="text-[10px] text-accent hover:text-accent/80 font-medium"
                          >
                            {isExpanded ? 'Hide' : 'Files'}
                          </button>
                          <button
                            onClick={() => setRestoreTarget(entry)}
                            className="text-[10px] text-foreground-dim hover:text-foreground-muted font-medium"
                          >
                            Restore
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/30 px-2 py-1.5 space-y-0.5">
                          {expandedFiles.map((file) => {
                            const badge = STATUS_BADGE[file.status] || STATUS_BADGE.modified;
                            return (
                              <button
                                key={file.path}
                                onClick={() => {
                                  onFileClick(file.path);
                                  // Show the commit diff in the diff pane
                                  if (expandedDiff) {
                                    viewCommitDiff(expandedDiff, file.path);
                                  }
                                }}
                                className="flex items-center gap-1.5 w-full text-left rounded px-1 py-0.5 text-[11px] hover:bg-accent-bg transition-colors"
                              >
                                <span className={cn('px-0.5 rounded text-[9px] font-mono font-bold shrink-0', badge.className)}>
                                  {badge.label}
                                </span>
                                <span className="truncate text-foreground-muted">{file.path}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: diff viewer */}
        <div className="flex-1 overflow-auto">
          {diffContent !== null ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center px-4 py-2 border-b shrink-0">
                <span className="text-[12px] text-foreground-muted truncate flex-1 font-mono">{selectedFile}</span>
                {diffSource !== 'commit' && (
                  <span className="text-[10px] text-foreground-dim mr-2">
                    {diffSource === 'staged' ? 'staged' : 'unstaged'}
                  </span>
                )}
                <button
                  onClick={() => { setSelectedFile(null); setDiffContent(null); }}
                  className="text-[11px] text-foreground-dim hover:text-foreground ml-2"
                >
                  Close
                </button>
              </div>
              {diffContent.trim() ? (
                <pre className="flex-1 text-[13px] font-mono p-4 leading-relaxed overflow-auto">
                  {diffContent.split('\n').map((line, i) => {
                    let cls = 'text-foreground-dim';
                    if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-green-400';
                    else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400';
                    else if (line.startsWith('@@')) cls = 'text-blue-400';
                    return <div key={i} className={cls}>{line}</div>;
                  })}
                </pre>
              ) : (
                <div className="flex items-center justify-center flex-1 text-foreground-dim text-[13px]">
                  No changes detected — try unstaging and re-staging the file
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-foreground-dim text-[13px]">
              {isClean ? 'Working tree clean' : 'Select a file to view diff'}
            </div>
          )}
        </div>
      </div>

      {/* Sync warning dialog */}
      <AlertDialog open={showSyncWarning} onOpenChange={(open) => { if (!open) setShowSyncWarning(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit without syncing?</AlertDialogTitle>
            <AlertDialogDescription>
              {SYNC_WARNINGS[derivedMode] || 'You have unsynced changes.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSyncWarning(false); doCommit(); }}>
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert confirmation dialog */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all unsaved changes to <strong>{revertTarget}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertConfirm} className="bg-destructive hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore to this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert all files to commit <strong>{restoreTarget?.shortHash}</strong>.
              Uncommitted changes will be lost. A new commit will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm} disabled={restoring}>
              {restoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
