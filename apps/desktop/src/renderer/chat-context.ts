import type { ChatContext } from '../shared/types';

const SECTION_FILES: Record<string, string> = {
  main: '.jamo/creator/_sections/main.json',
  tech: '.jamo/creator/_sections/tech.json',
  brand: '.jamo/creator/_sections/brand.json',
  'user-stories': '.jamo/creator/_sections/user-stories.json',
};

function extractTextFromTiptap(json: string): string {
  try {
    const doc = JSON.parse(json);
    if (!doc.content) return '';
    const texts: string[] = [];
    for (const node of doc.content) {
      if (node.content) {
        for (const inline of node.content) {
          if (inline.text) texts.push(inline.text);
        }
        texts.push('\n');
      }
    }
    return texts.join('').trim();
  } catch {
    return '';
  }
}

export async function buildChatContext(
  wsId: string,
  openFile?: string | null,
): Promise<ChatContext> {
  const context: ChatContext = {};

  // Include currently open file
  if (openFile && !openFile.startsWith('.jamo/')) {
    context.openFile = openFile;
    try {
      const result = await window.jamo.readFile(wsId, openFile);
      context.openFileContent = result.content;
    } catch {
      // File might not exist or be binary
    }
  }

  // Include project sections for context
  const projectSections: Record<string, string> = {};
  for (const [name, filePath] of Object.entries(SECTION_FILES)) {
    try {
      const result = await window.jamo.readFile(wsId, filePath);
      const text = extractTextFromTiptap(result.content);
      if (text) {
        projectSections[name] = text;
      }
    } catch {
      // Section doesn't exist yet
    }
  }

  if (Object.keys(projectSections).length > 0) {
    context.projectSections = projectSections;
  }

  return context;
}
