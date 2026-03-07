export const SECTIONS_DIR = '.jamo/creator/_sections';

export interface Section {
  id: string;
  label: string;
  fileName: string;
  filePath: string;
  editorType: 'richtext' | 'canvas';
  defaultContent: () => object;
}

function makeRichTextDoc(heading: string, placeholder: string) {
  return {
    version: 1,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: heading }],
        },
        {
          type: 'paragraph',
        },
      ],
    },
  };
}

function makeCanvasDoc() {
  return {
    version: 1,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements: [],
    appState: {},
  };
}

export const SECTIONS: Section[] = [
  {
    id: 'main',
    label: 'Main',
    fileName: 'main.json',
    filePath: `${SECTIONS_DIR}/main.json`,
    editorType: 'richtext',
    defaultContent: () => makeRichTextDoc('Main', 'Describe your app\'s purpose...'),
  },
  {
    id: 'flow',
    label: 'Flow',
    fileName: 'flow.json',
    filePath: `${SECTIONS_DIR}/flow.json`,
    editorType: 'canvas',
    defaultContent: makeCanvasDoc,
  },
  {
    id: 'tech',
    label: 'Tech',
    fileName: 'tech.json',
    filePath: `${SECTIONS_DIR}/tech.json`,
    editorType: 'richtext',
    defaultContent: () => makeRichTextDoc('Tech', 'Platform, tools, and preferences...'),
  },
  {
    id: 'brand',
    label: 'Brand',
    fileName: 'brand.json',
    filePath: `${SECTIONS_DIR}/brand.json`,
    editorType: 'richtext',
    defaultContent: () => makeRichTextDoc('Brand', 'Colors, fonts, and guidelines...'),
  },
  {
    id: 'user-stories',
    label: 'User Stories',
    fileName: 'user-stories.json',
    filePath: `${SECTIONS_DIR}/user-stories.json`,
    editorType: 'richtext',
    defaultContent: () => makeRichTextDoc('User Stories', 'Personas and goals...'),
  },
];

export function findSection(filePath: string): Section | undefined {
  return SECTIONS.find((s) => s.filePath === filePath);
}
