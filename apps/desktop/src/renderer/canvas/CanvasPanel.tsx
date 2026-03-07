import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from '../theme';
import { exportToClipboard } from './export';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SECTIONS_DIR, findSection } from '../sections';
import type { CanvasDocument } from './types';

const AUTOSAVE_DELAY_MS = 2000;
const BG_DARK = '#0d0d1a';
const BG_LIGHT = '#ffffff';

/** Derive display name from file path: ".jamo/creator/My Drawing.json" -> "My Drawing" */
function displayName(filePath: string): string {
  return (filePath.split('/').pop() || '').replace(/\.json$/, '');
}

interface CanvasPanelProps {
  workspaceId: string;
  filePath: string;
  onClose: () => void;
  onFileRenamed?: (oldPath: string, newPath: string) => void;
  readOnly?: boolean;
}

export default function CanvasPanel({ workspaceId, filePath, onClose, onFileRenamed, readOnly }: CanvasPanelProps) {
  const { theme } = useTheme();
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
        // Migrate old documents that had pages
        if (parsed.pages && !parsed.elements) {
          parsed.elements = [];
          parsed.appState = {};
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

  // Intercept Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveDocument();
      }
    };
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

  const isSection = filePath.startsWith(SECTIONS_DIR);

  // Rename = rename the actual file
  const startRename = useCallback(() => {
    if (isSection) return;
    setEditName(displayName(filePath));
    setEditing(true);
  }, [filePath, isSection]);

  const commitRename = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === displayName(filePath)) {
      setEditing(false);
      return;
    }
    try {
      // Save current state first
      await saveDocument();
      // Move file to new name
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      const newPath = `${parentDir}/${trimmed}.json`;
      await window.jamo.moveFile(workspaceId, filePath, newPath);
      setEditing(false);
      onFileRenamed?.(filePath, newPath);
    } catch (err: any) {
      console.error('Failed to rename:', err);
      alert('Failed to rename: ' + (err?.message || err));
      setEditing(false);
    }
  }, [editName, filePath, workspaceId, saveDocument, onFileRenamed]);

  const name = findSection(filePath)?.label ?? displayName(filePath);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-muted">
        Loading...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-dim">
        Failed to load document
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-2.5 py-1 border-b gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { saveDocument(); onClose(); }}
          title="Close document"
          className="text-foreground-muted text-xs h-7"
        >
          Close
        </Button>
        {editing ? (
          <Input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="text-[13px] font-semibold w-[200px] h-7 bg-background-deep border-border-accent"
          />
        ) : (
          <span
            className="text-[13px] font-semibold cursor-pointer"
            onDoubleClick={startRename}
            title="Double-click to rename"
          >
            {name}
          </span>
        )}
        {saved && <span className="text-[10px] text-success">Saved</span>}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          title="Export for AI (copies JSON to clipboard)"
          className="text-[11px] h-7"
        >
          Export for AI
        </Button>
      </div>

      <div className="flex-1 relative">
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
          onChange={readOnly ? undefined : handleChange}
          theme={theme}
          UIOptions={{
            canvasActions: {
              saveAsImage: true,
              export: false,
              saveToActiveFile: false,
              changeViewBackgroundColor: !readOnly,
            },
          }}
        />
      </div>
    </div>
  );
}
