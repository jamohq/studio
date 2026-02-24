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
  refreshKey?: number;
}

export default function CreatorPanel({ workspaceId, activeFile, onOpenFile, refreshKey }: CreatorPanelProps) {
  const { tokens } = useTheme();
  const [nodes, setNodes] = useState<CreatorNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDirParent, setNewDirParent] = useState<string | null>(null);
  const [newDirName, setNewDirName] = useState('');
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const loadDir = useCallback(async (dirPath: string): Promise<CreatorNode[]> => {
    try {
      const res = await window.jamo.listDirectory(workspaceId, dirPath);
      const entries = (res.entries || [])
        .filter((e) => e.isDir || e.name.endsWith('.json'))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      const result: CreatorNode[] = [];
      for (const entry of entries) {
        const path = `${dirPath}/${entry.name}`;
        let displayName = entry.name;

        if (!entry.isDir && entry.name.endsWith('.json')) {
          try {
            const fileRes = await window.jamo.readFile(workspaceId, path);
            const doc = JSON.parse(fileRes.content);
            displayName = doc.name || entry.name.replace(/\.json$/, '');
          } catch {
            displayName = entry.name.replace(/\.json$/, '');
          }
        }

        result.push({
          entry,
          path,
          displayName,
          expanded: false,
          loaded: false,
        });
      }
      return result;
    } catch {
      return [];
    }
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = await loadDir(CREATOR_DIR);
    setNodes(items);
    setLoading(false);
  }, [loadDir]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

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

  const handleCreate = useCallback(async () => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const name = 'Untitled';
    const fileName = `doc-${id}.json`;
    const doc = {
      version: 1,
      id,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      elements: [],
      appState: {},
    };
    const filePath = `${CREATOR_DIR}/${fileName}`;
    await window.jamo.writeFile(workspaceId, filePath, JSON.stringify(doc, null, 2));
    onOpenFile(filePath);
    refresh();
  }, [workspaceId, onOpenFile, refresh]);

  const handleCreateDir = useCallback(async (parentPath: string) => {
    setNewDirParent(parentPath);
    setNewDirName('');
  }, []);

  const commitNewDir = useCallback(async () => {
    const trimmed = newDirName.trim();
    if (!trimmed || !newDirParent) {
      setNewDirParent(null);
      return;
    }
    const dirPath = `${newDirParent}/${trimmed}`;
    await window.jamo.createDirectory(workspaceId, dirPath);
    setNewDirParent(null);
    refresh();
  }, [newDirName, newDirParent, workspaceId, refresh]);

  const handleDrop = useCallback(async (targetDirPath: string) => {
    if (!dragPath || dragPath === targetDirPath) {
      setDragPath(null);
      setDropTarget(null);
      return;
    }
    const fileName = dragPath.split('/').pop()!;
    const newPath = `${targetDirPath}/${fileName}`;
    if (newPath === dragPath) {
      setDragPath(null);
      setDropTarget(null);
      return;
    }
    try {
      await window.jamo.moveFile(workspaceId, dragPath, newPath);
      // If moved the active file, update the open file path
      if (activeFile === dragPath) {
        onOpenFile(newPath);
      }
      refresh();
    } catch (err) {
      console.error('Failed to move file:', err);
    }
    setDragPath(null);
    setDropTarget(null);
  }, [dragPath, workspaceId, activeFile, onOpenFile, refresh]);

  const handleFileClick = (node: CreatorNode) => {
    if (node.entry.isDir) {
      toggleDir(node.path);
    } else {
      onOpenFile(node.path);
    }
  };

  const renderNode = (node: CreatorNode, depth: number) => {
    const isDir = node.entry.isDir;
    const isActive = activeFile === node.path;
    const isDropping = dropTarget === node.path;

    return (
      <React.Fragment key={node.path}>
        <div
          onClick={() => handleFileClick(node)}
          draggable={!isDir}
          onDragStart={(e) => {
            setDragPath(node.path);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            if (isDir && dragPath) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropTarget(node.path);
            }
          }}
          onDragLeave={() => {
            if (dropTarget === node.path) setDropTarget(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (isDir) handleDrop(node.path);
          }}
          style={{
            padding: '4px 8px',
            paddingLeft: 12 + depth * 16,
            fontSize: 12,
            cursor: 'pointer',
            color: tokens.text,
            background: isDropping ? tokens.accentBg : isActive ? tokens.accentBg : 'transparent',
            borderTop: isDropping ? `1px solid ${tokens.accent}` : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isDir ? (
            <span style={{ fontSize: 10, width: 12, textAlign: 'center', color: tokens.textMuted }}>
              {node.expanded ? '\u25BE' : '\u25B8'}
            </span>
          ) : (
            <span style={{ width: 12, textAlign: 'center', fontSize: 10, color: tokens.accent }}>&#9674;</span>
          )}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.displayName}
          </span>
          {isDir && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateDir(node.path);
              }}
              title="New subfolder"
              style={{
                background: 'transparent',
                border: 'none',
                color: tokens.textMuted,
                cursor: 'pointer',
                fontSize: 12,
                lineHeight: 1,
                padding: '0 2px',
                visibility: 'visible',
              }}
            >
              +
            </button>
          )}
        </div>
        {isDir && node.expanded && (
          <>
            {newDirParent === node.path && (
              <div style={{ paddingLeft: 12 + (depth + 1) * 16, padding: '2px 8px' }}>
                <input
                  autoFocus
                  placeholder="folder name"
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value)}
                  onBlur={commitNewDir}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitNewDir();
                    if (e.key === 'Escape') setNewDirParent(null);
                  }}
                  style={{
                    fontSize: 12,
                    background: tokens.bgDeep,
                    border: `1px solid ${tokens.borderAccent}`,
                    borderRadius: 3,
                    color: tokens.text,
                    padding: '1px 6px',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            )}
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </>
        )}
      </React.Fragment>
    );
  };

  // Root drop zone — drop to move to CREATOR_DIR root
  const isRootDrop = dropTarget === CREATOR_DIR;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onDragOver={(e) => {
        if (dragPath) {
          e.preventDefault();
          setDropTarget(CREATOR_DIR);
        }
      }}
      onDragLeave={(e) => {
        // Only clear if leaving the panel entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropTarget(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dropTarget === CREATOR_DIR) handleDrop(CREATOR_DIR);
      }}
    >
      <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: tokens.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Creator</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => handleCreateDir(CREATOR_DIR)}
            title="New folder"
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.text,
              cursor: 'pointer',
              fontSize: 13,
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            &#128193;
          </button>
          <button
            onClick={handleCreate}
            title="New canvas document"
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.text,
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            +
          </button>
        </div>
      </div>

      {newDirParent === CREATOR_DIR && (
        <div style={{ padding: '2px 12px' }}>
          <input
            autoFocus
            placeholder="folder name"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            onBlur={commitNewDir}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitNewDir();
              if (e.key === 'Escape') setNewDirParent(null);
            }}
            style={{
              fontSize: 12,
              background: tokens.bgDeep,
              border: `1px solid ${tokens.borderAccent}`,
              borderRadius: 3,
              color: tokens.text,
              padding: '1px 6px',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8, borderTop: isRootDrop && nodes.length > 0 ? `1px solid ${tokens.accent}` : undefined }}>
        {loading && <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textMuted }}>Loading...</div>}
        {!loading && nodes.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textDim }}>
            No creator files yet
          </div>
        )}
        {nodes.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
}
