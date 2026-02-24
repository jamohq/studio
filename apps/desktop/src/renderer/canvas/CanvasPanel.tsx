import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from '../theme';
import { exportToClipboard } from './export';
import type { CanvasDocument } from './types';

const AUTOSAVE_DELAY_MS = 2000;
const BG_DARK = '#0d0d1a';
const BG_LIGHT = '#ffffff';

interface CanvasPanelProps {
  workspaceId: string;
  filePath: string; // relative path like .jamo/creator/doc-xxx.json
  onClose: () => void;
  onRenamed?: (filePath: string, newName: string) => void;
}

export default function CanvasPanel({ workspaceId, filePath, onClose, onRenamed }: CanvasPanelProps) {
  const { theme, tokens } = useTheme();
  const [doc, setDoc] = useState<CanvasDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const docRef = useRef<CanvasDocument | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  docRef.current = doc;

  // Load document
  useEffect(() => {
    setLoading(true);
    setDoc(null);
    (async () => {
      try {
        const res = await window.jamo.readFile(workspaceId, filePath);
        const parsed = JSON.parse(res.content);
        // Migrate old multi-page documents
        if (parsed.pages && !parsed.elements) {
          parsed.elements = [];
          parsed.appState = { viewBackgroundColor: '#0d0d1a' };
          delete parsed.pages;
          delete parsed.activePageIndex;
        }
        setDoc(parsed);
      } catch (err) {
        console.error('Failed to load canvas document:', filePath, err);
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId, filePath]);

  // Save document
  const saveDocument = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    const updated = { ...d, updatedAt: new Date().toISOString() };
    await window.jamo.writeFile(workspaceId, filePath, JSON.stringify(updated, null, 2));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [workspaceId, filePath]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDocument(), AUTOSAVE_DELAY_MS);
  }, [saveDocument]);

  // Intercept Cmd+S to save to our file instead of Excalidraw's native save dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveDocument();
      }
    };
    // Use capture phase to intercept before Excalidraw sees it
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [saveDocument]);

  const handleChange = useCallback(
    (elements: readonly any[], appState: any) => {
      setDoc((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          elements,
          appState: {
            ...prev.appState,
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize ?? null,
            zenModeEnabled: appState.zenModeEnabled,
          },
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleExport = useCallback(() => {
    if (!doc) return;
    exportToClipboard(doc);
  }, [doc]);

  // Rename support
  const startRename = useCallback(() => {
    if (!doc) return;
    setEditName(doc.name);
    setEditing(true);
  }, [doc]);

  const commitRename = useCallback(() => {
    const trimmed = editName.trim();
    if (!trimmed || !doc) {
      setEditing(false);
      return;
    }
    setDoc((prev) => prev ? { ...prev, name: trimmed } : prev);
    setEditing(false);
    // Save immediately with new name
    setTimeout(() => saveDocument(), 0);
    onRenamed?.(filePath, trimmed);
  }, [editName, doc, saveDocument, filePath, onRenamed]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: tokens.textMuted }}>
        Loading...
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: tokens.textDim }}>
        Failed to load document
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderBottom: `1px solid ${tokens.border}`, gap: 8, flexShrink: 0 }}>
        <button
          style={{ background: 'transparent', border: 'none', color: tokens.textMuted, cursor: 'pointer', fontSize: 12 }}
          onClick={() => { saveDocument(); onClose(); }}
          title="Close document"
        >
          Close
        </button>
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              background: tokens.bgDeep,
              border: `1px solid ${tokens.borderAccent}`,
              borderRadius: 3,
              color: tokens.text,
              padding: '1px 6px',
              outline: 'none',
              width: 200,
            }}
          />
        ) : (
          <span
            style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onDoubleClick={startRename}
            title="Double-click to rename"
          >
            {doc.name}
          </span>
        )}
        {saved && <span style={{ fontSize: 10, color: tokens.success }}>Saved</span>}
        <div style={{ flex: 1 }} />
        <button
          style={{ background: 'transparent', border: `1px solid ${tokens.border}`, borderRadius: 4, color: tokens.textMuted, cursor: 'pointer', fontSize: 11, padding: '3px 10px' }}
          onClick={handleExport}
          title="Export for AI (copies JSON to clipboard)"
        >
          Export for AI
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <Excalidraw
          key={theme}
          initialData={{
            elements: doc.elements as any,
            appState: {
              ...doc.appState,
              theme,
              viewBackgroundColor: theme === 'dark' ? BG_DARK : BG_LIGHT,
            } as any,
          }}
          onChange={handleChange}
          theme={theme}
          UIOptions={{
            canvasActions: {
              saveAsImage: true,
              export: false,
              saveToActiveFile: false,
            },
          }}
        />
      </div>
    </div>
  );
}
