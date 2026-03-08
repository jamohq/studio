import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

function getCssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return '';
  // CSS vars are in "H S% L%" format — convert to hsl().
  return `hsl(${raw})`;
}

function lightTheme(): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: getCssVar('--background-surface') || '#ffffff',
      color: getCssVar('--foreground') || '#222222',
    },
    '.cm-gutters': {
      backgroundColor: getCssVar('--background') || '#f5f5f5',
      color: getCssVar('--foreground-dim') || '#999999',
      borderRight: `1px solid ${getCssVar('--border') || '#d0d0d0'}`,
    },
    '.cm-activeLineGutter': {
      backgroundColor: getCssVar('--accent-bg') || '#e8e8f4',
    },
    '.cm-activeLine': {
      backgroundColor: getCssVar('--accent-bg') || '#e8e8f4',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: getCssVar('--foreground') || '#222222',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: getCssVar('--accent-bg') || '#e8e8f4',
    },
  });
}

export function getEditorTheme(appTheme: 'dark' | 'light'): Extension[] {
  if (appTheme === 'dark') {
    return [oneDark];
  }
  return [lightTheme()];
}
