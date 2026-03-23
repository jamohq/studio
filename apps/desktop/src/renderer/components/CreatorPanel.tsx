import React, { useCallback, useEffect, useState, useRef } from 'react';
import { FolderPlus, FilePlus, Diamond } from 'lucide-react';
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
import { SECTIONS, SECTIONS_DIR } from '../sections';
import { GENERATE_CODE_PROMPT, UPDATE_CODE_PROMPT } from '../prompts';
import type { FileEntry } from '../../shared/types';

const CREATOR_DIR = '.jamo/creator';

interface CreatorNode {
  entry: FileEntry;
  path: string;
  displayName: string;
  children?: CreatorNode[];
  expanded?: boolean;
  loaded?: boolean;
}

interface CreatorPanelProps {
  workspaceId: string;
  activeFile: string | null;
  onOpenFile: (relPath: string) => void;
  onFileDeleted?: (relPath: string) => void;
  refreshKey?: number;
  onExecuteAction?: (prompt: string, label: string) => void;
  terminalReady?: boolean;
  actionRunning?: boolean;
}

/** Strip .json for display */
function nameFromFile(filename: string): string {
  return filename.replace(/\.json$/, '');
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export default function CreatorPanel({ workspaceId, activeFile, onOpenFile, onFileDeleted, refreshKey, onExecuteAction, terminalReady, actionRunning }: CreatorPanelProps) {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<CreatorNode[]>([]);
  const nodesRef = useRef<CreatorNode[]>([]);
  nodesRef.current = nodes;
  const [loading, setLoading] = useState(true);
  const [newDirParent, setNewDirParent] = useState<string | null>(null);
  const [newDirName, setNewDirName] = useState('');
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // -----------------------------------------------------------------------
  // Ensure .jamo/creator exists
  // -----------------------------------------------------------------------
  const ensureCreatorDir = useCallback(async () => {
    await window.jamo.createDirectory(workspaceId, CREATOR_DIR);
  }, [workspaceId]);

  // -----------------------------------------------------------------------
  // Load directory
  // -----------------------------------------------------------------------
  const loadDir = useCallback(async (dirPath: string): Promise<CreatorNode[]> => {
    try {
      const res = await window.jamo.listDirectory(workspaceId, dirPath);
      return (res.entries || [])
        .filter((e) => e.name !== '_sections')
        .filter((e) => e.isDir || e.name.endsWith('.json'))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((entry) => ({
          entry,
          path: `${dirPath}/${entry.name}`,
          displayName: entry.isDir ? entry.name : nameFromFile(entry.name),
          expanded: false,
          loaded: false,
        }));
    } catch {
      return [];
    }
  }, [workspaceId]);

  // -----------------------------------------------------------------------
  // Refresh (preserves expansion)
  // -----------------------------------------------------------------------
  const refresh = useCallback(async () => {
    setLoading(true);
    const expandedPaths = new Set<string>();
    const collectExpanded = (items: CreatorNode[]) => {
      for (const n of items) {
        if (n.entry.isDir && n.expanded) {
          expandedPaths.add(n.path);
          if (n.children) collectExpanded(n.children);
        }
      }
    };
    collectExpanded(nodesRef.current);

    const loadWithExpansion = async (dirPath: string): Promise<CreatorNode[]> => {
      const items = await loadDir(dirPath);
      for (let i = 0; i < items.length; i++) {
        const node = items[i];
        if (node.entry.isDir && expandedPaths.has(node.path)) {
          const children = await loadWithExpansion(node.path);
          items[i] = { ...node, expanded: true, loaded: true, children };
        }
      }
      return items;
    };

    const items = await loadWithExpansion(CREATOR_DIR);
    setNodes(items);
    setLoading(false);
  }, [loadDir]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  // -----------------------------------------------------------------------
  // Toggle directory
  // -----------------------------------------------------------------------
  const toggleDir = useCallback(async (path: string) => {
    const toggle = async (items: CreatorNode[]): Promise<CreatorNode[]> => {
      const result: CreatorNode[] = [];
      for (const node of items) {
        if (node.path === path && node.entry.isDir) {
          if (!node.loaded) {
            const children = await loadDir(node.path);
            result.push({ ...node, expanded: true, loaded: true, children });
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
  // Create new file (dialog)
  // -----------------------------------------------------------------------
  const handleCreateFile = useCallback(async (name: string, parentPath: string) => {
    try {
      await ensureCreatorDir();
      const parts = name.split('/').map((s) => s.trim()).filter(Boolean);
      const docName = parts.pop()!;
      let targetDir = parentPath;

      for (const dir of parts) {
        targetDir = `${targetDir}/${dir}`;
        await window.jamo.createDirectory(workspaceId, targetDir);
      }

      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const doc = {
        version: 1,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        elements: [],
        appState: {},
      };
      const filePath = `${targetDir}/${docName}.json`;
      await window.jamo.writeFile(workspaceId, filePath, JSON.stringify(doc, null, 2));
      onOpenFile(filePath);
      refresh();
    } catch (err: any) {
      console.error('Failed to create file:', err);
      toast({ title: 'Failed to create file', description: err?.message || String(err), variant: 'error' });
    }
  }, [workspaceId, onOpenFile, refresh, ensureCreatorDir]);

  // -----------------------------------------------------------------------
  // Create folder (inline input)
  // -----------------------------------------------------------------------
  const handleCreateDir = useCallback(async (parentPath: string) => {
    if (parentPath !== CREATOR_DIR) {
      const expandNode = async (items: CreatorNode[]): Promise<CreatorNode[]> => {
        const result: CreatorNode[] = [];
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
      await ensureCreatorDir();
      await window.jamo.createDirectory(workspaceId, `${newDirParent}/${trimmed}`);
      setNewDirParent(null);
      refresh();
    } catch (err: any) {
      console.error('Failed to create directory:', err);
      toast({ title: 'Failed to create folder', description: err?.message || String(err), variant: 'error' });
      setNewDirParent(null);
    } finally {
      commitNewDirRef.current = false;
    }
  }, [newDirName, newDirParent, workspaceId, refresh, ensureCreatorDir]);

  // -----------------------------------------------------------------------
  // Rename
  // -----------------------------------------------------------------------
  const startRename = useCallback((node: CreatorNode) => {
    setRenamePath(node.path);
    setRenameValue(node.displayName);
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
    if (!node || trimmed === node.displayName) {
      setRenamePath(null);
      return;
    }

    commitRenameRef.current = true;
    try {
      const parentDir = renamePath.substring(0, renamePath.lastIndexOf('/'));
      const newPath = node.entry.isDir
        ? `${parentDir}/${trimmed}`
        : `${parentDir}/${trimmed}.json`;

      if (newPath !== renamePath) {
        await window.jamo.moveFile(workspaceId, renamePath, newPath);
        if (activeFile === renamePath) {
          onOpenFile(newPath);
        }
      }
      setRenamePath(null);
      refresh();
    } catch (err: any) {
      console.error('Failed to rename:', err);
      toast({ title: 'Failed to rename', description: err?.message || String(err), variant: 'error' });
      setRenamePath(null);
    } finally {
      commitRenameRef.current = false;
    }
  }, [renameValue, renamePath, workspaceId, activeFile, onOpenFile, refresh]);

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------
  const handleDelete = useCallback(async (node: CreatorNode) => {
    const label = node.entry.isDir ? 'folder' : 'file';
    if (!confirm(`Delete ${label} "${node.displayName}"?`)) return;
    try {
      await window.jamo.deleteFile(workspaceId, node.path);
      if (activeFile && (activeFile === node.path || activeFile.startsWith(node.path + '/'))) {
        onFileDeleted?.(activeFile);
      }
      refresh();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }, [workspaceId, activeFile, onFileDeleted, refresh]);

  // -----------------------------------------------------------------------
  // Drag and drop
  // -----------------------------------------------------------------------
  const handleDrop = useCallback(async (targetDirPath: string) => {
    if (!dragPath || dragPath === targetDirPath) { setDragPath(null); setDropTarget(null); return; }
    if (targetDirPath.startsWith(dragPath + '/')) { setDragPath(null); setDropTarget(null); return; }
    const fileName = dragPath.split('/').pop()!;
    const newPath = `${targetDirPath}/${fileName}`;
    if (newPath === dragPath) { setDragPath(null); setDropTarget(null); return; }
    try {
      await window.jamo.moveFile(workspaceId, dragPath, newPath);
      if (activeFile === dragPath) onOpenFile(newPath);
      refresh();
    } catch (err) {
      console.error('Failed to move:', err);
    }
    setDragPath(null);
    setDropTarget(null);
  }, [dragPath, workspaceId, activeFile, onOpenFile, refresh]);

  // -----------------------------------------------------------------------
  // Section click (lazy create)
  // -----------------------------------------------------------------------
  const handleSectionClick = useCallback(async (section: typeof SECTIONS[number]) => {
    try {
      await window.jamo.readFile(workspaceId, section.filePath);
    } catch {
      await ensureCreatorDir();
      await window.jamo.createDirectory(workspaceId, SECTIONS_DIR);
      await window.jamo.writeFile(
        workspaceId,
        section.filePath,
        JSON.stringify(section.defaultContent(), null, 2),
      );
    }
    onOpenFile(section.filePath);
  }, [workspaceId, onOpenFile, ensureCreatorDir]);

  // -----------------------------------------------------------------------
  // Click
  // -----------------------------------------------------------------------
  const handleFileClick = (node: CreatorNode) => {
    if (node.entry.isDir) toggleDir(node.path);
    else onOpenFile(node.path);
  };

  // -----------------------------------------------------------------------
  // Build Code (Design → Code)
  // -----------------------------------------------------------------------
  const [confirmBuild, setConfirmBuild] = useState<{ onConfirm: () => void } | null>(null);

  const handleDesignToCode = useCallback(async () => {
    if (!onExecuteAction) return;

    // Check if design files exist.
    try {
      const res = await window.jamo.listDirectory(workspaceId, '.jamo/creator');
      const hasJson = res.entries.some((e: any) => e.name.endsWith('.json'));
      if (!hasJson) {
        toast({ title: 'No design files found', description: 'Create designs in the Design panel first.', variant: 'error' });
        return;
      }
    } catch {
      toast({ title: 'No design files found', description: 'Create designs in the Design panel first.', variant: 'error' });
      return;
    }

    // Detect: are there source files already? If yes → update, if no → generate.
    let hasSourceFiles = false;
    try {
      const res = await window.jamo.listDirectory(workspaceId, '');
      hasSourceFiles = res.entries.some((e: any) => e.name !== '.jamo' && e.name !== '.git' && e.name !== '.gitignore');
    } catch { /* ignore */ }

    const isGenerate = !hasSourceFiles;
    const prompt = isGenerate ? GENERATE_CODE_PROMPT : UPDATE_CODE_PROMPT;
    const label = isGenerate ? 'Generating code' : 'Updating code';

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
  // Render node
  // -----------------------------------------------------------------------
  const renderNode = (node: CreatorNode, depth: number) => {
    const isDir = node.entry.isDir;
    const isActive = activeFile === node.path;
    const isDropping = dropTarget === node.path;
    const isRenaming = renamePath === node.path;

    const nodeContent = (
      <div
        onClick={() => !isRenaming && handleFileClick(node)}
        onDoubleClick={(e) => { e.stopPropagation(); startRename(node); }}
        draggable
        onDragStart={(e) => { setDragPath(node.path); e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(e) => {
          if (isDir && dragPath && dragPath !== node.path && !node.path.startsWith(dragPath + '/')) {
            e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget(node.path);
          }
        }}
        onDragLeave={() => { if (dropTarget === node.path) setDropTarget(null); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (isDir) handleDrop(node.path); }}
        className={cn(
          'py-1 px-2 text-xs cursor-pointer text-foreground flex items-center gap-1',
          isDropping && 'bg-accent-bg border-t border-t-accent',
          !isDropping && isActive && 'bg-accent-bg',
          !isDropping && !isActive && 'border-t border-t-transparent',
        )}
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {isDir ? (
          <span className="text-[10px] w-3 text-center text-foreground-muted">{node.expanded ? '\u25BE' : '\u25B8'}</span>
        ) : (
          <span className="w-3 text-center text-[10px] text-accent">&#9674;</span>
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
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{node.displayName}</span>
        )}
      </div>
    );

    return (
      <React.Fragment key={node.path}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {nodeContent}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => startRename(node)}>Rename</ContextMenuItem>
            {isDir && (
              <>
                <ContextMenuItem onClick={() => setNewFileParent(node.path)}>New File</ContextMenuItem>
                <ContextMenuItem onClick={() => handleCreateDir(node.path)}>New Folder</ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onClick={() => handleDelete(node)}>Delete</ContextMenuItem>
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

  const isRootDrop = dropTarget === CREATOR_DIR;

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { if (dragPath) { e.preventDefault(); setDropTarget(CREATOR_DIR); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
      onDrop={(e) => { e.preventDefault(); if (dropTarget === CREATOR_DIR) handleDrop(CREATOR_DIR); }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase text-foreground-muted flex items-center justify-between">
        <span>Design</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCreateDir(CREATOR_DIR)}
            title="New folder"
            className="h-6 w-6"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setNewFileParent(CREATOR_DIR); setNewFileName(''); }}
            title="New canvas document"
            className="h-6 w-6"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="pb-1" data-tour="sections">
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            onClick={() => handleSectionClick(section)}
            className={cn(
              'py-1 px-2 text-xs cursor-pointer text-foreground flex items-center gap-1',
              activeFile === section.filePath ? 'bg-accent-bg' : 'hover:bg-accent-bg/50',
            )}
            style={{ paddingLeft: 12 }}
          >
            <Diamond className="h-3 w-3 text-accent shrink-0" />
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{section.label}</span>
          </div>
        ))}
      </div>

      {/* Pages sub-header */}
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-foreground-dim flex items-center justify-between">
        <span>Pages</span>
      </div>

      {/* Root-level new folder input */}
      {newDirParent === CREATOR_DIR && renderNewDirInput(0)}

      {/* File tree */}
      <div className={cn('flex-1 overflow-auto pb-2', isRootDrop && nodes.length > 0 && 'border-t border-t-accent')}>
        {loading && <div className="px-3 py-2 text-xs text-foreground-muted">Loading...</div>}
        {!loading && nodes.length === 0 && (
          <div className="px-3 py-2 text-xs text-foreground-dim">No creator files yet</div>
        )}
        {nodes.map((node) => renderNode(node, 0))}
      </div>

      {/* Build Code footer */}
      {onExecuteAction && (
        <div className="shrink-0 border-t px-3 py-2.5">
          <Button
            onClick={handleDesignToCode}
            disabled={actionRunning}
            size="sm"
            data-tour="build-code"
            className="w-full text-[11px] font-semibold h-8 bg-accent hover:bg-accent/90"
          >
            {actionRunning ? 'Running...' : 'Build Code'}
          </Button>
        </div>
      )}

      {/* Build Code confirmation dialog */}
      <AlertDialog open={!!confirmBuild} onOpenChange={(open) => { if (!open) setConfirmBuild(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Design → Code</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate application code from your designs. Existing source files may be overwritten.
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

      {/* New file dialog */}
      <Dialog open={!!newFileParent} onOpenChange={(open) => { if (!open) setNewFileParent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Canvas</DialogTitle>
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
            placeholder="Document name"
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

function findNode(nodes: CreatorNode[], path: string): CreatorNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) { const f = findNode(node.children, path); if (f) return f; }
  }
  return null;
}
