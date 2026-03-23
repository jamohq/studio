import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '@/lib/utils';
import { findSection } from '../sections';
import type { RichTextDocument } from './types';

const AUTOSAVE_DELAY_MS = 2000;

interface RichTextPanelProps {
  workspaceId: string;
  filePath: string;
  onClose: () => void;
  readOnly?: boolean;
}

export default function RichTextPanel({ workspaceId, filePath, onClose, readOnly }: RichTextPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const docRef = useRef<RichTextDocument | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingContent = useRef(true);
  const section = findSection(filePath);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[200px] px-6 py-4',
      },
    },
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const save = useCallback(async () => {
    const d = docRef.current;
    const ed = editorRef.current;
    if (!d || !ed) return;
    const updated: RichTextDocument = {
      ...d,
      updatedAt: new Date().toISOString(),
      content: ed.getJSON(),
    };
    docRef.current = updated;
    await window.jamo.writeFile(workspaceId, filePath, JSON.stringify(updated, null, 2));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [workspaceId, filePath]);

  const saveRef = useRef(save);
  saveRef.current = save;

  // Autosave on editor changes (skip the initial setContent during load)
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (loadingContent.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveRef.current(), AUTOSAVE_DELAY_MS);
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor]);

  // Load document
  useEffect(() => {
    if (!editor) return;
    setLoading(true);
    (async () => {
      try {
        const res = await window.jamo.readFile(workspaceId, filePath);
        const parsed: RichTextDocument = JSON.parse(res.content);
        docRef.current = parsed;
        loadingContent.current = true;
        editor.commands.setContent(parsed.content);
        // Allow the update event from setContent to fire before re-enabling autosave
        requestAnimationFrame(() => { loadingContent.current = false; });
      } catch (err) {
        console.error('Failed to load rich text document:', filePath, err);
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId, filePath, editor]);

  // Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  if (loading || !editor) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center px-2.5 py-1 border-b gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { save(); onClose(); }}
          title="Close document"
          className="text-foreground-muted text-xs h-7"
        >
          Close
        </Button>
        <span className="text-[13px] font-semibold">{section?.label ?? filePath.split('/').pop()?.replace(/\.json$/, '')}</span>
        {saved && <span className="text-[10px] text-success ml-1">Saved</span>}
        {readOnly && <span className="text-[10px] text-foreground-dim ml-1">(read-only)</span>}
        <div className="flex-1" />
        {!readOnly && <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto rich-text-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-accent-bg transition-colors',
        active && 'bg-accent-bg text-accent',
      )}
    >
      {children}
    </button>
  );
}
