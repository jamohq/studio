import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useTheme } from '../theme';
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
}

/** Strip .json for display */
function nameFromFile(filename: string): string {
  return filename.replace(/\.json$/, '');
}

// ---------------------------------------------------------------------------
// New-file modal
// ---------------------------------------------------------------------------
function NewFileModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const { tokens } = useTheme();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: tokens.bgSurface, border: `1px solid ${tokens.border}`, borderRadius: 8, padding: 20, width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text, marginBottom: 4 }}>New Canvas</div>
        <div style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 12 }}>
          Use <code style={{ background: tokens.bgDeep, padding: '0 3px', borderRadius: 2 }}>folder/name</code> to create inside a new folder.
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="Document name"
          style={{ width: '100%', fontSize: 13, padding: '6px 10px', background: tokens.bgDeep, border: `1px solid ${tokens.borderAccent}`, borderRadius: 4, color: tokens.text, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onCancel} style={{ background: 'transparent', border: `1px solid ${tokens.border}`, borderRadius: 4, color: tokens.textMuted, cursor: 'pointer', fontSize: 12, padding: '4px 14px' }}>Cancel</button>
          <button onClick={submit} style={{ background: tokens.accent, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, padding: '4px 14px' }}>Create</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------
interface ContextMenuState { x: number; y: number; node: CreatorNode; }

function ContextMenu({ menu, onRename, onDelete, onNewFile, onNewFolder, onClose }: {
  menu: ContextMenuState; onRename: () => void; onDelete: () => void; onNewFile: () => void; onNewFolder: () => void; onClose: () => void;
}) {
  const { tokens } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const itemStyle: React.CSSProperties = { padding: '5px 16px', fontSize: 12, cursor: 'pointer', color: tokens.text, whiteSpace: 'nowrap' };
  const hover = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = tokens.accentBg; };
  const unhover = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'transparent'; };
  const isDir = menu.node.entry.isDir;

  return (
    <div ref={ref} style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999, background: tokens.bgSurface, border: `1px solid ${tokens.border}`, borderRadius: 6, padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 140 }}>
      <div style={itemStyle} onMouseOver={hover} onMouseOut={unhover} onClick={() => { onRename(); onClose(); }}>Rename</div>
      {isDir && (
        <>
          <div style={itemStyle} onMouseOver={hover} onMouseOut={unhover} onClick={() => { onNewFile(); onClose(); }}>New File</div>
          <div style={itemStyle} onMouseOver={hover} onMouseOut={unhover} onClick={() => { onNewFolder(); onClose(); }}>New Folder</div>
        </>
      )}
      <div style={{ height: 1, background: tokens.border, margin: '4px 0' }} />
      <div style={{ ...itemStyle, color: tokens.danger }} onMouseOver={hover} onMouseOut={unhover} onClick={() => { onDelete(); onClose(); }}>Delete</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export default function CreatorPanel({ workspaceId, activeFile, onOpenFile, onFileDeleted, refreshKey }: CreatorPanelProps) {
  const { tokens } = useTheme();
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newFileParent, setNewFileParent] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Ensure .jamo/creator exists
  // -----------------------------------------------------------------------
  const ensureCreatorDir = useCallback(async () => {
    await window.jamo.createDirectory(workspaceId, CREATOR_DIR);
  }, [workspaceId]);

  // -----------------------------------------------------------------------
  // Load directory — no file reads needed, name = filename
  // -----------------------------------------------------------------------
  const loadDir = useCallback(async (dirPath: string): Promise<CreatorNode[]> => {
    try {
      const res = await window.jamo.listDirectory(workspaceId, dirPath);
      return (res.entries || [])
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
  // Create new file (modal)
  // -----------------------------------------------------------------------
  const handleCreateFile = useCallback(async (name: string, parentPath: string) => {
    try {
      await ensureCreatorDir();
      // name can be "folder/My Drawing" — create intermediate dirs
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
      // Filename = user-chosen name
      const filePath = `${targetDir}/${docName}.json`;
      await window.jamo.writeFile(workspaceId, filePath, JSON.stringify(doc, null, 2));
      onOpenFile(filePath);
      refresh();
    } catch (err: any) {
      console.error('Failed to create file:', err);
      alert('Failed to create file: ' + (err?.message || err));
    }
  }, [workspaceId, onOpenFile, refresh, ensureCreatorDir]);

  // -----------------------------------------------------------------------
  // Create folder (inline input)
  // -----------------------------------------------------------------------
  const handleCreateDir = useCallback(async (parentPath: string) => {
    // Auto-expand parent dir if needed
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
      alert('Failed to create directory: ' + (err?.message || err));
      setNewDirParent(null);
    } finally {
      commitNewDirRef.current = false;
    }
  }, [newDirName, newDirParent, workspaceId, refresh, ensureCreatorDir]);

  // -----------------------------------------------------------------------
  // Rename (double-click or context menu)
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
        // Update open file path if it was renamed
        if (activeFile === renamePath) {
          onOpenFile(newPath);
        }
      }
      setRenamePath(null);
      refresh();
    } catch (err: any) {
      console.error('Failed to rename:', err);
      alert('Failed to rename: ' + (err?.message || err));
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
  // Click
  // -----------------------------------------------------------------------
  const handleFileClick = (node: CreatorNode) => {
    if (node.entry.isDir) toggleDir(node.path);
    else onOpenFile(node.path);
  };

  // -----------------------------------------------------------------------
  // Render node
  // -----------------------------------------------------------------------
  const renderNode = (node: CreatorNode, depth: number) => {
    const isDir = node.entry.isDir;
    const isActive = activeFile === node.path;
    const isDropping = dropTarget === node.path;
    const isRenaming = renamePath === node.path;

    return (
      <React.Fragment key={node.path}>
        <div
          onClick={() => !isRenaming && handleFileClick(node)}
          onDoubleClick={(e) => { e.stopPropagation(); startRename(node); }}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, node }); }}
          draggable
          onDragStart={(e) => { setDragPath(node.path); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => {
            if (isDir && dragPath && dragPath !== node.path && !node.path.startsWith(dragPath + '/')) {
              e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget(node.path);
            }
          }}
          onDragLeave={() => { if (dropTarget === node.path) setDropTarget(null); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (isDir) handleDrop(node.path); }}
          style={{
            padding: '4px 8px', paddingLeft: 12 + depth * 16, fontSize: 12, cursor: 'pointer', color: tokens.text,
            background: isDropping ? tokens.accentBg : isActive ? tokens.accentBg : 'transparent',
            borderTop: isDropping ? `1px solid ${tokens.accent}` : '1px solid transparent',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {isDir ? (
            <span style={{ fontSize: 10, width: 12, textAlign: 'center', color: tokens.textMuted }}>{node.expanded ? '\u25BE' : '\u25B8'}</span>
          ) : (
            <span style={{ width: 12, textAlign: 'center', fontSize: 10, color: tokens.accent }}>&#9674;</span>
          )}
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamePath(null); }}
              onClick={(e) => e.stopPropagation()}
              style={{ flex: 1, fontSize: 12, background: tokens.bgDeep, border: `1px solid ${tokens.borderAccent}`, borderRadius: 3, color: tokens.text, padding: '0 4px', outline: 'none' }}
            />
          ) : (
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.displayName}</span>
          )}
        </div>
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
    <div style={{ paddingLeft: 12 + depth * 16, padding: '2px 8px' }}>
      <input
        autoFocus
        placeholder="folder name"
        value={newDirName}
        onChange={(e) => setNewDirName(e.target.value)}
        onBlur={commitNewDir}
        onKeyDown={(e) => { if (e.key === 'Enter') commitNewDir(); if (e.key === 'Escape') setNewDirParent(null); }}
        style={{ fontSize: 12, background: tokens.bgDeep, border: `1px solid ${tokens.borderAccent}`, borderRadius: 3, color: tokens.text, padding: '1px 6px', outline: 'none', width: '100%' }}
      />
    </div>
  );

  const isRootDrop = dropTarget === CREATOR_DIR;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onDragOver={(e) => { if (dragPath) { e.preventDefault(); setDropTarget(CREATOR_DIR); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
      onDrop={(e) => { e.preventDefault(); if (dropTarget === CREATOR_DIR) handleDrop(CREATOR_DIR); }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: tokens.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Creator</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => handleCreateDir(CREATOR_DIR)} title="New folder" style={{ background: 'transparent', border: 'none', color: tokens.text, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 4px' }}>&#128193;</button>
          <button onClick={() => setNewFileParent(CREATOR_DIR)} title="New canvas document" style={{ background: 'transparent', border: 'none', color: tokens.text, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>+</button>
        </div>
      </div>

      {/* Root-level new folder input */}
      {newDirParent === CREATOR_DIR && renderNewDirInput(0)}

      {/* File tree */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8, borderTop: isRootDrop && nodes.length > 0 ? `1px solid ${tokens.accent}` : undefined }}>
        {loading && <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textMuted }}>Loading...</div>}
        {!loading && nodes.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textDim }}>No creator files yet</div>
        )}
        {nodes.map((node) => renderNode(node, 0))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onRename={() => startRename(contextMenu.node)}
          onDelete={() => handleDelete(contextMenu.node)}
          onNewFile={() => setNewFileParent(contextMenu.node.path)}
          onNewFolder={() => handleCreateDir(contextMenu.node.path)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* New file modal */}
      {newFileParent && (
        <NewFileModal
          onConfirm={(name) => { handleCreateFile(name, newFileParent); setNewFileParent(null); }}
          onCancel={() => setNewFileParent(null)}
        />
      )}
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
