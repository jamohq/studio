import React, { useCallback, useEffect, useState, useRef } from 'react';
import { FolderPlus, FilePlus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { cn } from '@/lib/utils';
import { useToast } from './Toast';
import { GENERATE_CREATOR_PROMPT, UPDATE_CREATOR_PROMPT } from '../prompts';
import type { FileEntry } from '../../shared/types';

interface ExplorerPanelProps {
  workspaceId: string;
  onOpenFile?: (relPath: string) => void;
  onFileDeleted?: (relPath: string) => void;
  activeFile?: string | null;
  onExecuteAction?: (prompt: string, label: string) => void;
  terminalReady?: boolean;
  actionRunning?: boolean;
}

interface TreeNode {
  entry: FileEntry;
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

export default function ExplorerPanel({ workspaceId, onOpenFile, onFileDeleted, activeFile, onExecuteAction, terminalReady, actionRunning }: ExplorerPanelProps) {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const nodesRef = useRef<TreeNode[]>([]);
  nodesRef.current = nodes;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  // Inline rename state
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Inline new-folder state
  const [newDirParent, setNewDirParent] = useState<string | null>(null);
  const [newDirName, setNewDirName] = useState('');

  // New-file dialog state
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // Delete confirmation (single or batch)
  const [deletePaths, setDeletePaths] = useState<string[] | null>(null);

  // Move-to-folder dialog
  const [movePaths, setMovePaths] = useState<string[] | null>(null);
  const [moveTarget, setMoveTarget] = useState('');

  // -----------------------------------------------------------------------
  // Load directory
  // -----------------------------------------------------------------------
  const loadDir = useCallback(async (relPath: string): Promise<TreeNode[]> => {
    const res = await window.jamo.listDirectory(workspaceId, relPath);
    const entries = (res.entries || []).filter((e) => !e.name.startsWith('.'));
    return entries
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({
        entry,
        path: relPath && relPath !== '.' ? `${relPath}/${entry.name}` : entry.name,
        expanded: false,
        loaded: false,
      }));
  }, [workspaceId]);

  // -----------------------------------------------------------------------
  // Refresh (preserves expansion)
  // -----------------------------------------------------------------------
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const expandedPaths = new Set<string>();
    const collectExpanded = (items: TreeNode[]) => {
      for (const n of items) {
        if (n.entry.isDir && n.expanded) {
          expandedPaths.add(n.path);
          if (n.children) collectExpanded(n.children);
        }
      }
    };
    collectExpanded(nodesRef.current);

    const loadWithExpansion = async (dirPath: string): Promise<TreeNode[]> => {
      const items = await loadDir(dirPath);
      for (let i = 0; i < items.length; i++) {
        const node = items[i];
        if (node.entry.isDir && expandedPaths.has(node.path)) {
          try {
            const children = await loadWithExpansion(node.path);
            items[i] = { ...node, expanded: true, loaded: true, children };
          } catch { /* collapsed if dir gone */ }
        }
      }
      return items;
    };

    try {
      const items = await loadWithExpansion('.');
      setNodes(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  }, [loadDir]);

  useEffect(() => { refresh(); }, [refresh]);

  // -----------------------------------------------------------------------
  // Collect flat list of visible paths (for shift-click range select)
  // -----------------------------------------------------------------------
  const flatPaths = useCallback((): string[] => {
    const result: string[] = [];
    const walk = (items: TreeNode[]) => {
      for (const node of items) {
        result.push(node.path);
        if (node.entry.isDir && node.expanded && node.children) {
          walk(node.children);
        }
      }
    };
    walk(nodesRef.current);
    return result;
  }, []);

  // -----------------------------------------------------------------------
  // Selection helpers
  // -----------------------------------------------------------------------
  const handleSelect = useCallback((path: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle individual
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
      });
      lastClickedRef.current = path;
    } else if (e.shiftKey && lastClickedRef.current) {
      // Range select
      const paths = flatPaths();
      const a = paths.indexOf(lastClickedRef.current);
      const b = paths.indexOf(path);
      if (a >= 0 && b >= 0) {
        const [start, end] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(paths[i]);
          return next;
        });
      }
    } else {
      // Plain click — clear selection
      setSelected(new Set());
      lastClickedRef.current = path;
    }
  }, [flatPaths]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  // -----------------------------------------------------------------------
  // Toggle directory
  // -----------------------------------------------------------------------
  const toggleDir = useCallback(async (path: string) => {
    const toggle = async (items: TreeNode[]): Promise<TreeNode[]> => {
      const result: TreeNode[] = [];
      for (const node of items) {
        if (node.path === path && node.entry.isDir) {
          if (!node.loaded) {
            try {
              const children = await loadDir(node.path);
              result.push({ ...node, expanded: true, loaded: true, children });
            } catch {
              result.push({ ...node, expanded: false });
            }
          } else {
            result.push({ ...node, expanded: !node.expanded });
          }
        } else if (node.children) {
          result.push({ ...node, children: await toggle(node.children) });
        } else {
          result.push(node);
        }
      }
      return result;
    };
    setNodes(await toggle(nodes));
  }, [nodes, loadDir]);

  // -----------------------------------------------------------------------
  // Rename
  // -----------------------------------------------------------------------
  const startRename = useCallback((node: TreeNode) => {
    setRenamePath(node.path);
    setRenameValue(node.entry.name);
    setSelected(new Set());
  }, []);

  const commitRenameRef = useRef(false);
  const commitRename = useCallback(async () => {
    if (commitRenameRef.current) return;
    const trimmed = renameValue.trim();
    if (!trimmed || !renamePath) {
      setRenamePath(null);
      return;
    }

    const node = findNode(nodesRef.current, renamePath);
    if (!node || trimmed === node.entry.name) {
      setRenamePath(null);
      return;
    }

    commitRenameRef.current = true;
    try {
      const parentDir = renamePath.includes('/') ? renamePath.substring(0, renamePath.lastIndexOf('/')) : '.';
      const newPath = parentDir === '.' ? trimmed : `${parentDir}/${trimmed}`;

      if (newPath !== renamePath) {
        await window.jamo.moveFile(workspaceId, renamePath, newPath);
        if (activeFile === renamePath) {
          onOpenFile?.(newPath);
        }
      }
      setRenamePath(null);
      refresh();
    } catch (err: any) {
      toast({ title: 'Failed to rename', description: err?.message || String(err), variant: 'error' });
      setRenamePath(null);
    } finally {
      commitRenameRef.current = false;
    }
  }, [renameValue, renamePath, workspaceId, activeFile, onOpenFile, refresh, toast]);

  // -----------------------------------------------------------------------
  // Delete (batch-aware)
  // -----------------------------------------------------------------------
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletePaths || deletePaths.length === 0) return;
    try {
      for (const p of deletePaths) {
        await window.jamo.deleteFile(workspaceId, p);
      }
      if (activeFile) {
        const affected = deletePaths.some((p) => activeFile === p || activeFile.startsWith(p + '/'));
        if (affected) onFileDeleted?.(activeFile);
      }
      setDeletePaths(null);
      setSelected(new Set());
      refresh();
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err?.message || String(err), variant: 'error' });
      setDeletePaths(null);
    }
  }, [workspaceId, deletePaths, activeFile, onFileDeleted, refresh, toast]);

  // -----------------------------------------------------------------------
  // Move (batch-aware)
  // -----------------------------------------------------------------------
  const handleMoveConfirm = useCallback(async () => {
    if (!movePaths || !moveTarget.trim()) return;
    const target = moveTarget.trim();
    try {
      // Ensure target directory exists
      if (target !== '.') {
        await window.jamo.createDirectory(workspaceId, target);
      }
      for (const p of movePaths) {
        const name = p.split('/').pop()!;
        const newPath = target === '.' ? name : `${target}/${name}`;
        if (newPath !== p) {
          await window.jamo.moveFile(workspaceId, p, newPath);
          if (activeFile === p) onOpenFile?.(newPath);
        }
      }
      setMovePaths(null);
      setMoveTarget('');
      setSelected(new Set());
      refresh();
    } catch (err: any) {
      toast({ title: 'Failed to move', description: err?.message || String(err), variant: 'error' });
      setMovePaths(null);
    }
  }, [workspaceId, movePaths, moveTarget, activeFile, onOpenFile, refresh, toast]);

  // -----------------------------------------------------------------------
  // Create folder (inline input)
  // -----------------------------------------------------------------------
  const handleCreateDir = useCallback(async (parentPath: string) => {
    if (parentPath !== '.') {
      const expandNode = async (items: TreeNode[]): Promise<TreeNode[]> => {
        const result: TreeNode[] = [];
        for (const node of items) {
          if (node.path === parentPath && node.entry.isDir && !node.expanded) {
            const children = node.loaded ? (node.children || []) : await loadDir(node.path);
            result.push({ ...node, expanded: true, loaded: true, children });
          } else if (node.children) {
            result.push({ ...node, children: await expandNode(node.children) });
          } else {
            result.push(node);
          }
        }
        return result;
      };
      setNodes(await expandNode(nodes));
    }
    setNewDirParent(parentPath);
    setNewDirName('');
  }, [nodes, loadDir]);

  const commitNewDirRef = useRef(false);
  const commitNewDir = useCallback(async () => {
    if (commitNewDirRef.current) return;
    const trimmed = newDirName.trim();
    if (!trimmed || !newDirParent) {
      setNewDirParent(null);
      return;
    }
    commitNewDirRef.current = true;
    try {
      const fullPath = newDirParent === '.' ? trimmed : `${newDirParent}/${trimmed}`;
      await window.jamo.createDirectory(workspaceId, fullPath);
      setNewDirParent(null);
      refresh();
    } catch (err: any) {
      toast({ title: 'Failed to create folder', description: err?.message || String(err), variant: 'error' });
      setNewDirParent(null);
    } finally {
      commitNewDirRef.current = false;
    }
  }, [newDirName, newDirParent, workspaceId, refresh, toast]);

  // -----------------------------------------------------------------------
  // Create file (dialog)
  // -----------------------------------------------------------------------
  const handleCreateFile = useCallback(async (name: string, parentPath: string) => {
    try {
      const parts = name.split('/').map((s) => s.trim()).filter(Boolean);
      const fileName = parts.pop()!;
      let targetDir = parentPath;

      for (const dir of parts) {
        targetDir = targetDir === '.' ? dir : `${targetDir}/${dir}`;
        await window.jamo.createDirectory(workspaceId, targetDir);
      }

      const filePath = targetDir === '.' ? fileName : `${targetDir}/${fileName}`;
      await window.jamo.writeFile(workspaceId, filePath, '');
      onOpenFile?.(filePath);
      refresh();
    } catch (err: any) {
      toast({ title: 'Failed to create file', description: err?.message || String(err), variant: 'error' });
    }
  }, [workspaceId, onOpenFile, refresh, toast]);

  // -----------------------------------------------------------------------
  // Update Designs (Code → Design)
  // -----------------------------------------------------------------------
  const [confirmBuild, setConfirmBuild] = useState<{ onConfirm: () => void } | null>(null);

  const handleCodeToDesign = useCallback(async () => {
    if (!onExecuteAction) return;

    try {
      const res = await window.jamo.listDirectory(workspaceId, '');
      const hasFiles = res.entries.some((e: any) => e.name !== '.jamo' && e.name !== '.git' && e.name !== '.gitignore');
      if (!hasFiles) {
        toast({ title: 'No source files found', description: 'Add code files to the project first.', variant: 'error' });
        return;
      }
    } catch { /* ignore */ }

    let hasDesignFiles = false;
    try {
      const res = await window.jamo.listDirectory(workspaceId, '.jamo/creator');
      hasDesignFiles = res.entries.some((e: any) => e.name.endsWith('.json'));
    } catch { /* ignore */ }

    const isGenerate = !hasDesignFiles;
    const prompt = isGenerate ? GENERATE_CREATOR_PROMPT : UPDATE_CREATOR_PROMPT;
    const label = isGenerate ? 'Generating designs' : 'Updating designs';

    const execute = async () => {
      try { await window.jamo.gitInit(workspaceId); } catch { /* ignore */ }
      onExecuteAction(prompt, label);
    };

    if (isGenerate) {
      setConfirmBuild({
        onConfirm: () => { setConfirmBuild(null); execute(); },
      });
    } else {
      execute();
    }
  }, [workspaceId, onExecuteAction, toast]);

  // -----------------------------------------------------------------------
  // Context menu helpers — resolve paths for batch operations
  // -----------------------------------------------------------------------
  /** Returns paths to operate on: if the right-clicked node is in the selection, use the full selection; otherwise just the single node. */
  const resolveTargets = useCallback((nodePath: string): string[] => {
    if (selected.size > 0 && selected.has(nodePath)) {
      return [...selected];
    }
    return [nodePath];
  }, [selected]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const renderNewDirInput = (depth: number) => (
    <div className="px-2 py-0.5" style={{ paddingLeft: 12 + depth * 16 }}>
      <input
        autoFocus
        placeholder="folder name"
        value={newDirName}
        onChange={(e) => setNewDirName(e.target.value)}
        onBlur={commitNewDir}
        onKeyDown={(e) => { if (e.key === 'Enter') commitNewDir(); if (e.key === 'Escape') setNewDirParent(null); }}
        className="text-xs bg-background-deep border border-border-accent rounded-sm text-foreground px-1.5 py-px outline-none w-full"
      />
    </div>
  );

  const renderNode = (node: TreeNode, depth: number) => {
    const isDir = node.entry.isDir;
    const isActive = activeFile === node.path;
    const isRenaming = renamePath === node.path;
    const isSelected = selected.has(node.path);

    const handleClick = (e: React.MouseEvent) => {
      if (isRenaming) return;
      const isMultiAction = e.metaKey || e.ctrlKey || e.shiftKey;
      if (isMultiAction) {
        handleSelect(node.path, e);
      } else {
        handleSelect(node.path, e);
        if (isDir) toggleDir(node.path);
        else onOpenFile?.(node.path);
      }
    };

    const nodeContent = (
      <div
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); startRename(node); }}
        className={cn(
          'py-[3px] px-2 text-xs text-foreground flex items-center gap-1 cursor-pointer',
          isSelected ? 'bg-accent-bg' : isActive ? 'bg-accent-bg/60' : 'hover:bg-accent-bg/50',
        )}
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {isDir ? (
          <span className="text-[10px] w-3 text-center text-foreground-muted">
            {node.expanded ? '\u25BE' : '\u25B8'}
          </span>
        ) : (
          <span className="w-3" />
        )}
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamePath(null); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-xs bg-background-deep border border-border-accent rounded-sm text-foreground px-1 outline-none"
          />
        ) : (
          <span className="truncate">{node.entry.name}</span>
        )}
      </div>
    );

    const targets = resolveTargets(node.path);
    const isBatch = targets.length > 1;

    return (
      <React.Fragment key={node.path}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {nodeContent}
          </ContextMenuTrigger>
          <ContextMenuContent>
            {!isBatch && (
              <ContextMenuItem onClick={() => startRename(node)}>Rename</ContextMenuItem>
            )}
            {!isBatch && isDir && (
              <>
                <ContextMenuItem onClick={() => { setNewFileParent(node.path); setNewFileName(''); }}>New File</ContextMenuItem>
                <ContextMenuItem onClick={() => handleCreateDir(node.path)}>New Folder</ContextMenuItem>
              </>
            )}
            <ContextMenuItem onClick={() => { setMovePaths(targets); setMoveTarget(''); }}>
              {isBatch ? `Move ${targets.length} items...` : 'Move to...'}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onClick={() => setDeletePaths(targets)}>
              {isBatch ? `Delete ${targets.length} items` : 'Delete'}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {isDir && node.expanded && (
          <>
            {newDirParent === node.path && renderNewDirInput(depth + 1)}
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </>
        )}
      </React.Fragment>
    );
  };

  const hasSelection = selected.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase text-foreground-muted flex items-center justify-between">
        <span>
          Explorer
          {hasSelection && (
            <span className="ml-1 normal-case font-normal text-foreground-dim">
              ({selected.size} selected)
            </span>
          )}
        </span>
        <div className="flex gap-1">
          {hasSelection && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletePaths([...selected])}
                title={`Delete ${selected.size} selected`}
                className="h-6 w-6 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCreateDir('.')}
            title="New folder"
            className="h-6 w-6"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setNewFileParent('.'); setNewFileName(''); }}
            title="New file"
            className="h-6 w-6"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Root-level new folder input */}
      {newDirParent === '.' && renderNewDirInput(0)}

      {/* File tree */}
      <div className="flex-1 overflow-auto pb-2" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
        {loading && <div className="px-3 py-2 text-xs text-foreground-muted">Loading...</div>}
        {error && <div className="px-3 py-2 text-xs text-foreground-dim">{error}</div>}
        {!loading && !error && nodes.length === 0 && (
          <div className="px-3 py-2 text-xs text-foreground-dim">Empty workspace</div>
        )}
        {nodes.map((node) => renderNode(node, 0))}
      </div>

      {/* Update Designs footer */}
      {onExecuteAction && (
        <div className="shrink-0 border-t px-3 py-2.5">
          <Button
            onClick={handleCodeToDesign}
            disabled={actionRunning}
            size="sm"
            className="w-full text-[11px] font-semibold h-8 bg-accent hover:bg-accent/90"
          >
            {actionRunning ? 'Running...' : 'Update Designs'}
          </Button>
        </div>
      )}

      {/* Build confirmation dialog */}
      <AlertDialog open={!!confirmBuild} onOpenChange={(open) => { if (!open) setConfirmBuild(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Code → Design</AlertDialogTitle>
            <AlertDialogDescription>
              This will analyze your code and generate design files from scratch. Existing designs will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBuild?.onConfirm} className="bg-accent text-white hover:bg-accent/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletePaths} onOpenChange={(open) => { if (!open) setDeletePaths(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletePaths && deletePaths.length > 1 ? `${deletePaths.length} items` : 'file'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletePaths && deletePaths.length === 1 ? (
                <>This will permanently delete <strong>{deletePaths[0].split('/').pop()}</strong>. This cannot be undone.</>
              ) : (
                <>This will permanently delete <strong>{deletePaths?.length} items</strong>. This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move dialog */}
      <Dialog open={!!movePaths} onOpenChange={(open) => { if (!open) { setMovePaths(null); setMoveTarget(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {movePaths && movePaths.length > 1 ? `${movePaths.length} items` : movePaths?.[0]?.split('/').pop()}
            </DialogTitle>
            <DialogDescription>
              Enter the destination folder path. Use <code className="bg-background-deep px-1 rounded text-xs">.</code> for root.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && moveTarget.trim()) handleMoveConfirm();
              if (e.key === 'Escape') { setMovePaths(null); setMoveTarget(''); }
            }}
            placeholder="Destination folder (e.g. src/components)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMovePaths(null); setMoveTarget(''); }}>Cancel</Button>
            <Button onClick={handleMoveConfirm} disabled={!moveTarget.trim()}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New file dialog */}
      <Dialog open={!!newFileParent} onOpenChange={(open) => { if (!open) setNewFileParent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              Use <code className="bg-background-deep px-1 rounded text-xs">folder/name</code> to create inside a new folder.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = newFileName.trim();
                if (trimmed && newFileParent) {
                  handleCreateFile(trimmed, newFileParent);
                  setNewFileParent(null);
                  setNewFileName('');
                }
              }
              if (e.key === 'Escape') { setNewFileParent(null); setNewFileName(''); }
            }}
            placeholder="File name (e.g. index.html)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewFileParent(null); setNewFileName(''); }}>Cancel</Button>
            <Button onClick={() => {
              const trimmed = newFileName.trim();
              if (trimmed && newFileParent) {
                handleCreateFile(trimmed, newFileParent);
                setNewFileParent(null);
                setNewFileName('');
              }
            }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) { const f = findNode(node.children, path); if (f) return f; }
  }
  return null;
}
