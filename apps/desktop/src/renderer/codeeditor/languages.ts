import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

const LANG_MAP: Record<string, () => Extension> = {
  '.js': () => javascript(),
  '.jsx': () => javascript({ jsx: true }),
  '.mjs': () => javascript(),
  '.ts': () => javascript({ typescript: true }),
  '.tsx': () => javascript({ typescript: true, jsx: true }),
  '.py': () => python(),
  '.go': () => go(),
  '.html': () => html(),
  '.htm': () => html(),
  '.css': () => css(),
  '.scss': () => css(),
  '.json': () => json(),
  '.md': () => markdown(),
  '.mdx': () => markdown(),
  '.yaml': () => javascript(), // passable highlighting
  '.yml': () => javascript(),
};

export function getLanguageExtension(filePath: string): Extension | null {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = filePath.slice(dot).toLowerCase();
  const factory = LANG_MAP[ext];
  return factory ? factory() : null;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.avi', '.mov',
  '.exe', '.dll', '.so', '.dylib', '.bin',
]);

export function isBinaryFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}
