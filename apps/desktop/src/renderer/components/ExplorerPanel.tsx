import React, { useCallback, useEffect, useState } from 'react';
import type { FileEntry } from '../../shared/types';

interface ExplorerPanelProps {
  workspaceId: string;
  onOpenFile?: (relPath: string) => void;
}

interface TreeNode {
  entry: FileEntry;
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

export default function ExplorerPanel({ workspaceId, onOpenFile }: ExplorerPanelProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDir = useCallback(async (relPath: string): Promise<TreeNode[]> => {
    try {
      const res = await window.jamo.listDirectory(workspaceId, relPath);
      const entries = (res.entries || []).filter((e) => !e.name.startsWith('.'));
      return entries
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((entry) => ({
          entry,
          path: relPath ? `${relPath}/${entry.name}` : entry.name,
          expanded: false,
          loaded: false,
        }));
    } catch (err: any) {
      console.error('listDirectory failed:', relPath, err);
      throw err;
    }
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDir('.').then(
      (n) => {
        if (!cancelled) {
          setNodes(n);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to list directory');
          setLoading(false);
        }
      },
    );
    return () => { cancelled = true; };
  }, [loadDir]);

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

  const renderNode = (node: TreeNode, depth: number) => {
    const isDir = node.entry.isDir;
    return (
      <React.Fragment key={node.path}>
        <div
          onClick={() => isDir ? toggleDir(node.path) : onOpenFile?.(node.path)}
          className="py-[3px] px-2 text-xs text-foreground flex items-center gap-1 cursor-pointer hover:bg-accent-bg/50"
          style={{ paddingLeft: 12 + depth * 16 }}
        >
          {isDir ? (
            <span className="text-[10px] w-3 text-center text-foreground-muted">
              {node.expanded ? '\u25BE' : '\u25B8'}
            </span>
          ) : (
            <span className="w-3" />
          )}
          <span className="truncate">{node.entry.name}</span>
        </div>
        {isDir && node.expanded && node.children?.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase text-foreground-muted">
        Files
      </div>
      <div className="flex-1 overflow-auto pb-2">
        {loading && <div className="px-3 py-2 text-xs text-foreground-muted">Loading...</div>}
        {error && <div className="px-3 py-2 text-xs text-foreground-dim">{error}</div>}
        {!loading && !error && nodes.length === 0 && (
          <div className="px-3 py-2 text-xs text-foreground-dim">Empty workspace</div>
        )}
        {nodes.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
}
