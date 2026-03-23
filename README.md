<p align="center">
  <img src="apps/desktop/assets/logo-wide.png" alt="Jamo Studio" width="280" />
</p>

<h3 align="center">A visual desktop app for Claude Code.</h3>

<p align="center">
  Jamo Studio wraps <a href="https://github.com/anthropics/claude-code">Claude Code</a> in a local-first desktop app with a visual canvas, rich context editor, code editor, terminal, and version control &mdash; so you can <em>see</em> what you're building while AI writes the code.
</p>

<p align="center">
  <a href="#install">Install</a> &middot;
  <a href="#why-jamo-studio">Why Jamo</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#comparison">Comparison</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/jamohq/studio?color=blue" alt="License" />
  <img src="https://img.shields.io/github/stars/jamohq/studio?style=social" alt="Stars" />
</p>

---

<!-- Replace this with an actual screenshot or demo GIF of the app -->
<!-- <p align="center">
  <img src="docs/assets/demo.gif" alt="Jamo Studio demo" width="720" />
</p> -->

## Why Jamo Studio?

[Claude Code](https://github.com/anthropics/claude-code) is the best agentic coding tool available — but it lives in your terminal. You describe what you want in text, and you review what it built in text. That works, but it leaves a lot on the table.

**What if Claude Code could see your wireframes, read your design docs, and understand the full picture of what you're building — not just the code?**

Jamo Studio gives Claude Code a visual layer:

- **Draw before you code.** Sketch wireframes, user flows, and architecture diagrams on an Excalidraw canvas. Claude Code sees these when it generates code.
- **Write rich context, not just prompts.** Describe your app's purpose, tech stack, brand guidelines, and user stories in structured documents that feed directly into AI generation.
- **See diffs, not just terminal output.** Review every AI change visually with tracked runs, history, and one-click revert.
- **Stay in one window.** Code editor, terminal, AI chat, canvas, file explorer, and git — all in one app.

Other tools like [Cursor](https://cursor.com), [Windsurf](https://windsurf.com), and [Cline](https://github.com/cline/cline) are AI-enhanced code editors. GUI wrappers like [Opcode](https://github.com/winfunc/opcode) and [Claudia](https://claudia.so) add session management on top of Claude Code. Jamo Studio is different — it's a **design-to-code workspace** where your visual context and written specs are first-class inputs to AI generation.

All of this runs **locally on your machine**. No cloud. No account. Your files, your git repo, your data.

## Features

### Claude Code Integration
Jamo Studio runs Claude Code under the hood. Your existing configuration, API keys, and workflows carry over. The app spawns a local Go engine that communicates with the Electron frontend over gRPC — everything stays on your machine.

### Visual Canvas
Excalidraw-based drawing surface for wireframes, user flows, and architecture diagrams. Your designs live alongside your code and inform AI generation.

### Project Sections
Structured rich text documents for your app's core context — purpose, tech stack, brand guidelines, user stories. These feed into AI generation so it understands *what* you're building, not just *how*.

### AI Chat
Context-aware AI assistant that can read your files, see your open designs, and make changes across your codebase. Every AI action is tracked as a **run** with full history.

### Code Editor
CodeMirror 6 with syntax highlighting, vim mode, and autosave.

### Built-in Terminal
Full terminal powered by a Go PTY backend. Run your dev server, install packages, run tests — without leaving the app.

### Source Control
Git-based version control with staging, commits, history, and one-click revert. AI actions are auto-committed with tags (`auto-code`, `auto-design`, `chat-log`) so you always know what changed and why.

### File Explorer
Create, rename, move, and delete files and folders. Drag-and-drop organization.

## How It Works

```
You design your app             Claude Code generates code
  (canvas + rich text)    --->   (tracked, reversible)
         ^                              |
         |                              v
  You review & iterate   <---   Code runs in terminal
```

Every generation is a **run** — tracked, reviewable, and reversible. Don't like the output? Add a note and re-run. Or just revert with one click.

## Comparison

| | Jamo Studio | Cursor / Windsurf | Cline | Opcode / Claudia |
|---|---|---|---|---|
| Visual canvas | Yes (Excalidraw) | No | No | No |
| Rich context docs | Yes | No | No | No |
| Claude Code native | Yes | No | No | Yes (GUI wrapper) |
| Code editor | Yes | Yes (VS Code fork) | Yes (VS Code ext) | No |
| Terminal | Yes | Yes | Via VS Code | No |
| Local-first | Yes | Partial | Yes | Yes |
| Open source | Yes (AGPL) | No | Yes | Yes |
| Cost | Free + your API key | $15-20/mo + usage | Free + your API key | Free + your API key |

## Install

### Download

Grab the latest release from [GitHub Releases](https://github.com/jamohq/studio/releases).

| Platform | Format |
|----------|--------|
| macOS (Apple Silicon) | `.dmg` / `.zip` |
| macOS (Intel) | `.dmg` / `.zip` |
| Windows (x64) | `.exe` installer |
| Windows (arm64) | `.exe` installer |
| Linux (x64) | `.AppImage` / `.deb` |
| Linux (arm64) | `.AppImage` / `.deb` |

### Prerequisites

Jamo Studio requires [Claude Code](https://github.com/anthropics/claude-code) to be installed:

```bash
npm install -g @anthropic-ai/claude-code
```

You'll need an Anthropic API key or a Claude Max subscription for Claude Code to work.

### From source

```bash
git clone https://github.com/jamohq/studio.git
cd studio
pnpm install
pnpm dev
```

Requires: Node.js 18+, pnpm, Go 1.21+, and `protoc` (for proto codegen).

## Architecture

Jamo Studio runs as two processes:

- **Electron + React/TypeScript frontend** (`apps/desktop/`) — the desktop UI
- **Go gRPC engine** (`engine/`) — workspace operations, terminal sessions, and file management

The Electron main process spawns the Go engine and communicates over gRPC with bearer token auth. Everything runs locally — no cloud, no account required.

```
apps/desktop/       Electron app (main + renderer)
engine/             Go gRPC backend
proto/jamo/v1/      Protocol buffer definitions
scripts/            Build and codegen scripts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

Jamo Studio is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Commercial licenses are available — contact [go.jhson@gmail.com](mailto:go.jhson@gmail.com) for details.
