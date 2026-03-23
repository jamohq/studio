# Jamo Studio — AI Generation System

## Vision

Jamo Studio treats AI generation as a **first-class tracked operation**, not a black box. Every generation — whether code-from-design, design-from-code, or conversational edit — is a **run** with inputs, outputs, notes, and history. Users steer the AI through results, not process.

---

## Core Concept: Runs

A **run** is a single unit of AI generation. It is tracked, replayable, and reviewable.

```
Run {
  id:          string
  type:        "design-to-code" | "code-to-design" | "edit-code" | "edit-design" | "chat"
  status:      "running" | "paused" | "completed" | "failed" | "cancelled"
  input: {
    files:     string[]          // source files or design files used as input
    snapshot:  string            // git ref or content hash of inputs at run start
    prompt:    string            // what the user asked (explicit or inferred)
    notes:     string            // one-time instructions for THIS run only
    parentRun: string | null     // if this is a re-run, link to the original
  }
  output: {
    files:     FileChange[]      // files created or modified
    preview:   string | null     // rendered preview if applicable
  }
  conversation: Message[]        // the AI messages during this run (hidden by default)
  createdAt:   timestamp
  completedAt: timestamp | null
}
```

### Why runs matter

Without runs, regeneration is stateless — the AI has no memory of what it tried before or why the user rejected it. With runs:

- The user can say "try again but make the buttons rounded" (one-time note)
- The system knows what was tried before (parent run linkage)
- The user can compare run outputs side-by-side
- The user can revert to a previous run's output
- The history of what was generated and why is preserved

---

## Generation Modes

### 1. Design → Code

**Trigger:** User has a canvas design open, clicks "Generate Code" or asks in chat.

**UX flow:**
1. User sees a progress indicator on affected files in the explorer
2. Files update in real-time as they are written — the user watches the file tree, not the AI's thinking
3. On completion, changed files are highlighted in the activity panel
4. User reviews by opening files — if unhappy, they can:
   - **Re-run with notes**: "Make the layout use CSS Grid instead of flexbox"
   - **Revert**: undo this run's changes (git-level revert of run output)
   - **Edit manually**: just change the code, the run is still tracked

**What the user does NOT see (by default):**
- The AI's reasoning or intermediate steps
- The prompt that was constructed from the design
- Token counts or model details

**What the user CAN see (on demand):**
- Expand the run in the activity panel to see the full AI conversation
- See the exact prompt that was sent (for debugging/learning)

### 2. Code → Design

**Trigger:** User has code files open, clicks "Generate Design" or asks in chat.

**UX flow:**
1. Progress indicator on the canvas
2. Canvas updates with generated design elements
3. User reviews the visual result — if unhappy:
   - Re-run with notes: "Use a sidebar layout instead of tabs"
   - Revert to previous design state
   - Edit the design manually on canvas

### 3. Edit Code via Chat

**Trigger:** User types a request about code in the chat panel.

Examples:
- "Add a dark mode toggle to the settings page"
- "Refactor the auth middleware to use JWT"
- "Fix the bug where the sidebar doesn't close on mobile"

**UX flow:**
1. Chat shows the user's message and a brief AI acknowledgment
2. Files update in the explorer as changes are made
3. Chat shows a summary of what was changed (file list + brief description)
4. User reviews files — same re-run/revert/edit options as above

### 4. Edit Design via Chat

**Trigger:** User types a request about design in the chat panel.

Examples:
- "Make the header sticky"
- "Change the color scheme to use blues instead of greens"
- "Add a modal for the delete confirmation"

**UX flow:**
1. Chat acknowledges the request
2. Canvas updates with the changes
3. Chat shows a summary of what was changed
4. User reviews — same options as above

### 5. General Chat

**Trigger:** User types anything in the chat panel.

The chat is context-aware:
- If a design is open and the message is about visuals → triggers design edit
- If code files are open and the message is about code → triggers code edit
- If the message is about generating one from the other → triggers the appropriate generation
- If the message is a general question → just answers in chat, no generation run

The chat should feel like talking to a collaborator who can see your screen, not like filling out a form.

---

## One-Time Run Notes

This is the key UX innovation. When a user re-runs a generation, they can attach **notes** that:

1. Apply ONLY to this run (not saved as permanent instructions)
2. Are stored with the run for history/debugging
3. Override or supplement the default generation behavior

**UI:** When clicking "Re-run" on a completed run, a text field appears:
```
┌─────────────────────────────────────────┐
│ Notes for this run (optional)           │
│                                         │
│ Use CSS Grid for the layout instead of  │
│ flexbox. Keep the color scheme.         │
│                                         │
│                        [Cancel] [Run]   │
└─────────────────────────────────────────┘
```

This solves the "it'll do the same thing" problem because the AI receives:
- The same inputs (design/code)
- The same base prompt
- PLUS the one-time notes as additional high-priority instructions
- PLUS knowledge of what the previous run produced (so it knows what to change)

---

## Run History Panel

A new panel (or section of the activity panel) that shows:

```
┌─ Run History ──────────────────────────┐
│                                        │
│ ● Run #5 — Edit Code via Chat    2m ago│
│   "Add dark mode toggle"              │
│   Changed: 3 files                     │
│   [Revert] [Re-run] [Details]          │
│                                        │
│ ● Run #4 — Design → Code       15m ago│
│   Note: "Use CSS Grid layout"          │
│   Changed: 5 files                     │
│   ↳ Re-run of Run #3                   │
│   [Revert] [Re-run] [Details]          │
│                                        │
│ ○ Run #3 — Design → Code       20m ago│
│   Changed: 5 files (reverted)          │
│   [Restore] [Re-run] [Details]         │
│                                        │
└────────────────────────────────────────┘
```

---

## Real-Time Mode (Future)

For users who want to see what the AI is doing as it works:

- A live stream of the AI's actions in a collapsible panel
- Ability to **pause** mid-generation
- Ability to **inject a correction** while the AI is still working ("actually, skip the tests for now")
- Ability to **cancel** and keep partial results

This is the "advanced" mode — not the default. Most users just want to see results.

---

## Architecture Notes

### Where runs are stored

Runs are stored in `.jamo/runs/` within the workspace:
```
.jamo/
  runs/
    run-{id}.json       # run metadata, inputs, notes
    run-{id}-conv.json  # AI conversation (may be large)
```

Runs reference git commits for their output snapshots. When a run completes, its file changes can be committed (manually or auto-committed) with a message linking to the run ID.

### Relationship to git

- Runs are NOT git commits — they are a layer above
- A run's output MAY correspond to one or more git commits
- Reverting a run = `git revert` of the commits associated with that run
- Run metadata lives outside git history (in `.jamo/`)

### Chat panel

The chat panel is a new section in the UI, likely in the right sidebar or bottom panel. It:
- Maintains conversation context within a session
- Can reference open files and canvas state
- Triggers runs when the user's intent requires generation
- Shows run summaries inline in the conversation

### AI integration

The generation engine communicates with Claude API:
- Design → Code: sends canvas export (Excalidraw JSON or rendered image) + file context
- Code → Design: sends code files + existing design context
- Chat edits: sends relevant files + conversation history + user message
- One-time notes are injected as high-priority system instructions for that call

---

## Implementation Priority

### Phase 1: Chat + Code Editing
- [ ] Add chat panel to the UI
- [ ] Integrate Claude API for code generation/editing
- [ ] Basic run tracking (create, complete, list)
- [ ] File change detection and display

### Phase 2: Run History + Notes
- [ ] Run history panel
- [ ] Re-run with one-time notes
- [ ] Run revert (git-level)
- [ ] Parent run linkage

### Phase 3: Design Integration
- [ ] Design → Code generation
- [ ] Code → Design generation
- [ ] Edit design via chat

### Phase 4: Real-Time Mode
- [ ] Live AI action stream
- [ ] Pause/resume generation
- [ ] Mid-run corrections
- [ ] Partial result retention
