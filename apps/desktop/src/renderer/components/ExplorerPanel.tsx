import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../theme';
import type { FileEntry } from '../../shared/types';

interface ExplorerPanelProps {
  workspaceId: string;
}

interface TreeNode {
  entry: FileEntry;
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

export default function ExplorerPanel({ workspaceId }: ExplorerPanelProps) {
  const { tokens } = useTheme();
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
          onClick={() => isDir && toggleDir(node.path)}
          style={{
            padding: '3px 8px',
            paddingLeft: 12 + depth * 16,
            fontSize: 12,
            cursor: isDir ? 'pointer' : 'default',
            color: tokens.text,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isDir && (
            <span style={{ fontSize: 10, width: 12, textAlign: 'center', color: tokens.textMuted }}>
              {node.expanded ? '\u25BE' : '\u25B8'}
            </span>
          )}
          {!isDir && <span style={{ width: 12 }} />}
          <span>{node.entry.name}</span>
        </div>
        {isDir && node.expanded && node.children?.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: tokens.textMuted }}>
        Explorer
      </div>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8 }}>
        {loading && <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textMuted }}>Loading...</div>}
        {error && <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textDim }}>{error}</div>}
        {!loading && !error && nodes.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: tokens.textDim }}>Empty workspace</div>
        )}
        {nodes.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
}
