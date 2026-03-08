import React, { useState, useCallback } from 'react';
import type { SyncMode } from '../hooks/useSyncStatus';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

const GENERATE_CREATOR_PROMPT = `Read the full codebase to understand every page, screen, and major UI component.

Delete everything inside .jamo/creator/ (including _sections/) and regenerate from scratch.

You must create TWO things:

## 1. Section files in .jamo/creator/_sections/

Create these project definition files by analyzing the codebase:

- **main.json** — Rich text describing the app's purpose, vision, and what it does. Format:
  { "version": 1, "id": "<unique>", "createdAt": "<ISO>", "updatedAt": "<ISO>", "content": <ProseMirror JSON doc> }
  The "content" field must be a valid ProseMirror/tiptap JSON document with a heading and paragraphs.

- **flow.json** — Excalidraw canvas showing navigation flow between pages/screens. Use rectangles for pages, arrows for navigation paths, and text labels. Same Excalidraw format as page files (see below).

- **tech.json** — Rich text documenting the tech stack: language, framework, platform, build tools, key dependencies, and architecture patterns found in the codebase. Same rich text format as main.json.

- **brand.json** — Rich text documenting colors, fonts, spacing conventions, and any design system patterns found in the codebase. Same rich text format as main.json.

- **user-stories.json** — Rich text listing user personas and key user stories/flows derived from the codebase features. Same rich text format as main.json.

Rich text ProseMirror JSON example for the "content" field:
{ "type": "doc", "content": [
  { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Title" }] },
  { "type": "paragraph", "content": [{ "type": "text", "text": "Description here." }] },
  { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Sub-section" }] },
  { "type": "bulletList", "content": [
    { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item 1" }] }] }
  ]}
]}

## 2. Page files in .jamo/creator/

For each page/screen, create one Excalidraw JSON file (e.g., login.json, dashboard.json, settings.json). You may use subdirectories to organize (e.g., .jamo/creator/auth/login.json).

Each file must follow this exact format:
{
  "version": 1,
  "id": "<unique-id>",
  "createdAt": "<ISO-8601>",
  "updatedAt": "<ISO-8601>",
  "elements": [ ...Excalidraw elements... ],
  "appState": {}
}

IMPORTANT font rules for Excalidraw elements:
- Do NOT use fontFamily values 1 (Virgil), 2 (Helvetica), or 3 (Cascadia) — these are legacy fonts that render incorrectly.
- Use fontFamily: 5 (Excalifont) for hand-drawn style text, fontFamily: 6 (Nunito) for clean sans-serif text, or fontFamily: 9 (Liberation Sans) for technical/monospace text.
- Default to fontFamily: 6 (Nunito) for all text elements unless a hand-drawn look is specifically desired.

IMPORTANT theme rules:
- Set all text element strokeColor to "#e0e0e0" (light text for dark backgrounds).
- Set all rectangle/shape strokeColor to "#e0e0e0" and backgroundColor to "transparent" or a dark tone.
- Do NOT set viewBackgroundColor in appState — the app controls that based on user's theme.

The elements array should contain Excalidraw elements that form a wireframe blueprint of the page — rectangles for containers/cards, text elements for labels/headings, arrows for navigation flows. Include text annotations that document the logic, state management, API calls, and user interactions for each component on the page.

Be thorough: every route/page in the app should get its own creator file.`;

const UPDATE_CREATOR_PROMPT = `Read all existing creator files in .jamo/creator/ (both _sections/ and page files) and read the current codebase.

Compare everything against the actual code and update what's changed:

## Section files (_sections/)

- **main.json** — Update the app description if the purpose/scope has changed (rich text, ProseMirror JSON in "content" field)
- **flow.json** — Update the navigation flow diagram to reflect current page routing and connections (Excalidraw canvas)
- **tech.json** — Update if tech stack, dependencies, or architecture patterns have changed (rich text)
- **brand.json** — Update if design tokens, colors, or fonts have changed (rich text)
- **user-stories.json** — Update if new user-facing features have been added or removed (rich text)

If any section file doesn't exist yet, create it. Preserve "id" and "createdAt" on existing files — only update "updatedAt" and content.

## Page files (everything outside _sections/)

Compare each page file against the actual code. For any page/screen that has changed:
- Update the Excalidraw elements and annotations to reflect the current implementation
- Preserve existing "id" and "createdAt" — only update "updatedAt" and content
- Keep format: { "version": 1, "id": "...", "createdAt": "...", "updatedAt": "...", "elements": [...], "appState": {} }

IMPORTANT font rules for Excalidraw elements:
- Do NOT use fontFamily values 1 (Virgil), 2 (Helvetica), or 3 (Cascadia) — these are legacy fonts that render incorrectly.
- Use fontFamily: 5 (Excalifont) for hand-drawn style, fontFamily: 6 (Nunito) for clean sans-serif, or fontFamily: 8 (Comic Shanns) for code/monospace.
- If existing elements use legacy font IDs (1, 2, or 3), migrate them to the modern equivalents (1->5, 2->6, 3->8).

If there are new pages/screens in the code that don't have creator files yet, create new files for them.
If there are creator files for pages that no longer exist in code, note this but leave them (the user can delete manually).

Do NOT delete and recreate files — update them in place.`;

const GENERATE_CODE_PROMPT = `Read all creator files in .jamo/creator/ to understand the intended application.

The creator directory has two areas you MUST read:

1. **_sections/** — Project definition files that provide high-level context:
   - main.json: App purpose, vision, and core description (rich text / ProseMirror JSON in the "content" field)
   - flow.json: Navigation flow diagram (Excalidraw canvas with elements showing how pages connect)
   - tech.json: Platform, frameworks, tools, and technical preferences (rich text)
   - brand.json: Colors, fonts, design guidelines (rich text)
   - user-stories.json: User personas, goals, and acceptance criteria (rich text)

2. **Page files** — Excalidraw blueprint .json files (everything outside _sections/) representing individual pages/screens with wireframe layouts and text annotations.

For rich text section files, the content is ProseMirror JSON inside the "content" field. Read the text content from the document nodes to understand the project requirements.

Based on ALL of this — sections for project context and page files for UI blueprints — generate the full application code. Create or overwrite source files as needed to implement every page/screen.

Follow the patterns and conventions already established in the codebase (framework, styling approach, file structure, naming conventions). Preserve any configuration files (package.json, tsconfig, etc.) — only modify application source code.

Use the tech section for framework/tooling decisions, brand section for styling, user stories for feature requirements, and page blueprints for UI layout and component structure.

Also generate a Makefile at the project root with a \`run\` target that starts the application for local development (e.g., \`npm run dev\`, \`go run .\`, \`python main.py\`).`;

const UPDATE_CODE_PROMPT = `Read all creator files in .jamo/creator/ and the current codebase.

The creator directory has two areas you MUST read:

1. **_sections/** — Project definition files with high-level context:
   - main.json: App purpose and vision (rich text — read the "content" field's ProseMirror JSON)
   - flow.json: Navigation flow diagram (Excalidraw canvas)
   - tech.json: Platform, frameworks, tools (rich text)
   - brand.json: Colors, fonts, design guidelines (rich text)
   - user-stories.json: Personas, goals, acceptance criteria (rich text)

2. **Page files** — Excalidraw blueprint .json files (everything outside _sections/) with wireframe layouts and annotations.

Compare the creator blueprints AND section definitions against the existing code. For any page/screen where the creator files describe different UI, layout, or behavior than what the code currently implements:
- Make targeted, incremental updates to the code to match the creator blueprints
- Apply any tech preferences, brand guidelines, and user story requirements from the sections
- Preserve existing code structure and patterns where possible
- Only modify files that need changes — don't rewrite files that already match

Use sections as the source of truth for project-level decisions (tech stack, branding, features) and page blueprints as the source of truth for UI layout and component behavior.

Ensure a Makefile exists at the project root with a \`run\` target that starts the application for local development. Create or update it if needed.`;

// ---------------------------------------------------------------------------
// Action definitions
// ---------------------------------------------------------------------------

interface ActionDef {
  id: string;
  label: string;
  description: string;
  prompt: string;
  destructive: boolean;
  /** Which sync mode this action triggers */
  targetMode?: 'creator_mode' | 'code_mode';
}

const ACTIONS: ActionDef[] = [
  {
    id: 'generate-creator',
    label: 'Generate Creator Files',
    description: 'Deletes everything in .jamo/creator/ and generates new sections and page blueprints from codebase',
    prompt: GENERATE_CREATOR_PROMPT,
    destructive: true,
    targetMode: 'creator_mode',
  },
  {
    id: 'update-creator',
    label: 'Update Creator Files',
    description: 'Compares existing creator files with code and updates them in place',
    prompt: UPDATE_CREATOR_PROMPT,
    destructive: false,
    targetMode: 'creator_mode',
  },
  {
    id: 'generate-code',
    label: 'Generate Code',
    description: 'Reads all creator files and generates full application code from blueprints',
    prompt: GENERATE_CODE_PROMPT,
    destructive: true,
    targetMode: 'code_mode',
  },
  {
    id: 'update-code',
    label: 'Update Code',
    description: 'Compares code with creator blueprints and makes targeted updates',
    prompt: UPDATE_CODE_PROMPT,
    destructive: false,
    targetMode: 'code_mode',
  },
];

// ---------------------------------------------------------------------------
// Actions panel
// ---------------------------------------------------------------------------

interface ActionsPanelProps {
  workspaceId: string;
  onExecuteAction: (prompt: string, label: string) => void;
  terminalReady: boolean;
  syncMode: SyncMode;
  onModeChange: (mode: SyncMode, actionId: string) => void;
}

function isActionDisabled(actionId: string, syncMode: SyncMode): string | null {
  if (syncMode === 'creator_mode' && (actionId === 'generate-code' || actionId === 'update-code')) {
    return 'Commit creator changes first';
  }
  if (syncMode === 'code_mode' && (actionId === 'generate-creator' || actionId === 'update-creator')) {
    return 'Commit code changes first';
  }
  return null;
}

export default function ActionsPanel({ workspaceId, onExecuteAction, terminalReady, syncMode, onModeChange }: ActionsPanelProps) {
  const [confirmAction, setConfirmAction] = useState<ActionDef | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const executeAction = useCallback(async (action: ActionDef) => {
    // Validate prerequisites.
    if (action.targetMode === 'creator_mode') {
      try {
        const res = await window.jamo.listDirectory(workspaceId, '');
        const hasFiles = res.entries.some((e) => e.name !== '.jamo');
        if (!hasFiles) {
          alert('No source files found in workspace. Add code files first.');
          return;
        }
      } catch { /* ignore */ }
    } else if (action.targetMode === 'code_mode') {
      try {
        const res = await window.jamo.listDirectory(workspaceId, '.jamo/creator');
        const hasJson = res.entries.some((e) => e.name.endsWith('.json'));
        if (!hasJson) {
          alert('No creator files found. Generate creator files first.');
          return;
        }
      } catch {
        alert('No creator files found. Generate creator files first.');
        return;
      }
    }

    // Init git (no-op if already initialized).
    try {
      await window.jamo.gitInit(workspaceId);
    } catch { /* ignore */ }

    // Set mode.
    if (action.targetMode) {
      onModeChange(action.targetMode, action.id);
    }

    onExecuteAction(action.prompt, action.label);
    setSentId(action.id);
    setTimeout(() => setSentId((prev) => (prev === action.id ? null : prev)), 3000);
  }, [workspaceId, onExecuteAction, onModeChange]);

  const handleClick = useCallback((action: ActionDef) => {
    if (action.destructive) {
      setConfirmAction(action);
    } else {
      executeAction(action);
    }
  }, [executeAction]);

  const handleConfirm = useCallback(() => {
    if (confirmAction) {
      executeAction(confirmAction);
      setConfirmAction(null);
    }
  }, [confirmAction, executeAction]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase text-foreground-muted">
        Actions
      </div>

      {/* Warning when terminal not connected */}
      {!terminalReady && (
        <div className="mx-2 mb-2 px-2.5 py-1.5 text-[11px] text-warning bg-background-deep rounded border border-warning/20">
          Terminal not connected. Actions will auto-open the terminal.
        </div>
      )}

      {/* Action cards */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {ACTIONS.map((action) => {
          const isSent = sentId === action.id;
          const disabledReason = isActionDisabled(action.id, syncMode);
          return (
            <Card
              key={action.id}
              className={cn(
                'mb-2 bg-background-deep',
                action.destructive && 'border-destructive/25',
                disabledReason && 'opacity-50',
              )}
            >
              <CardHeader className="p-2.5 pb-0">
                <CardTitle className="text-xs">{action.label}</CardTitle>
                <CardDescription className="text-[11px] leading-snug">
                  {action.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2.5 pt-2">
                <Button
                  onClick={() => handleClick(action)}
                  disabled={!!disabledReason}
                  title={disabledReason || undefined}
                  variant={isSent ? 'default' : action.destructive ? 'destructive' : 'default'}
                  size="sm"
                  className={cn(
                    'w-full text-[11px] font-semibold h-7',
                    isSent && 'bg-success hover:bg-success',
                    !isSent && !action.destructive && !disabledReason && 'bg-accent hover:bg-accent/90',
                  )}
                >
                  {disabledReason || (isSent ? 'Sent to Terminal' : 'Run')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AlertDialog for destructive actions */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {confirmAction?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a destructive action that will overwrite existing files.
              <br />
              <span className="text-foreground-dim text-[11px]">{confirmAction?.description}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-white hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
