import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { vim } from '@replit/codemirror-vim';
import { keymap } from '@codemirror/view';
import { useTheme } from '../theme';
import { getEditorTheme } from './theme';
import { getLanguageExtension, isBinaryFile } from './languages';
import { Button } from '../components/ui/button';

const AUTOSAVE_DELAY_MS = 2000;
const VIM_STORAGE_KEY = 'jamo-vim-mode';

interface CodeEditorPanelProps {
  workspaceId: string;
  filePath: string;
  onClose: () => void;
  readOnly?: boolean;
}

export default function CodeEditorPanel({ workspaceId, filePath, onClose, readOnly }: CodeEditorPanelProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vimEnabled, setVimEnabled] = useState(() => localStorage.getItem(VIM_STORAGE_KEY) === 'true');

  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<string>('');

  const fileName = filePath.split('/').pop() || filePath;
  const binary = isBinaryFile(filePath);

  // -- Save -------------------------------------------------------------------
  const save = useCallback(async () => {
    if (readOnly || !editorViewRef.current) return;
    const content = editorViewRef.current.state.doc.toString();
    if (content === contentRef.current) return; // No change.
    contentRef.current = content;
    try {
      await window.jamo.writeFile(workspaceId, filePath, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      console.error('Failed to save:', err);
    }
  }, [workspaceId, filePath, readOnly]);

  const saveRef = useRef(save);
  saveRef.current = save;

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveRef.current(), AUTOSAVE_DELAY_MS);
  }, []);

  // -- Build editor -----------------------------------------------------------
  const buildEditor = useCallback((content: string) => {
    if (!containerRef.current) return;

    // Destroy previous instance.
    editorViewRef.current?.destroy();
    editorViewRef.current = null;

    const extensions = [
      basicSetup,
      ...getEditorTheme(theme),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !readOnly) scheduleSave();
      }),
      // Cmd+S / Ctrl+S to save immediately.
      keymap.of([{
        key: 'Mod-s',
        run: () => { saveRef.current(); return true; },
      }]),
    ];

    // Language support.
    const lang = getLanguageExtension(filePath);
    if (lang) extensions.push(lang);

    // Vim mode.
    if (vimEnabled) extensions.push(vim());

    // Read-only.
    if (readOnly) extensions.push(EditorState.readOnly.of(true));

    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    editorViewRef.current = view;
  }, [theme, filePath, vimEnabled, readOnly, scheduleSave]);

  // -- Load file & create editor ----------------------------------------------
  useEffect(() => {
    if (binary) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await window.jamo.readFile(workspaceId, filePath);
        if (cancelled) return;
        contentRef.current = res.content;
        buildEditor(res.content);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load file');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [workspaceId, filePath, binary, buildEditor]);

  // -- Vim toggle -------------------------------------------------------------
  const toggleVim = useCallback(() => {
    setVimEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(VIM_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Rebuild editor when vim/theme changes (vimEnabled and theme are in buildEditor deps,
  // and buildEditor changes trigger the load effect to re-run, but we need to rebuild
  // without reloading the file). Use a separate effect for this.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    if (binary || loading || error) return;
    // Preserve current content from the editor.
    const currentContent = editorViewRef.current?.state.doc.toString() ?? contentRef.current;
    buildEditor(currentContent);
  }, [vimEnabled, theme]);

  // -- Close handler ----------------------------------------------------------
  const handleClose = useCallback(() => {
    // Flush pending save.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveRef.current();
    }
    onClose();
  }, [onClose]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center px-2.5 py-1 border-b gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={handleClose} className="text-[11px] h-7 text-foreground-muted">
          Close
        </Button>
        <span className="text-[13px] font-medium text-foreground truncate">{fileName}</span>
        {saved && <span className="text-[10px] text-success ml-1">Saved</span>}
        {readOnly && <span className="text-[10px] text-foreground-dim ml-1">(read-only)</span>}
        <div className="flex-1" />
        {!binary && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVim}
            className="text-[11px] h-7 text-foreground-muted"
          >
            Vim: {vimEnabled ? 'ON' : 'OFF'}
          </Button>
        )}
      </div>

      {/* Editor area */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-foreground-dim text-sm">Loading...</div>
      )}
      {error && (
        <div className="flex-1 flex items-center justify-center text-destructive text-sm">{error}</div>
      )}
      {binary && !loading && (
        <div className="flex-1 flex items-center justify-center text-foreground-dim text-sm">
          Binary file — cannot display
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ display: loading || error || binary ? 'none' : undefined }}
      />
    </div>
  );
}
