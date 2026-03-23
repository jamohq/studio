<p align="center">
  <img src="apps/desktop/assets/logo-wide.png" alt="Jamo Studio" width="280" />
</p>

<h3 align="center">Design, code, and ship — all in one local-first desktop app.</h3>

<p align="center">
  Jamo Studio is an open-source desktop IDE that combines a visual canvas, rich text editor, code editor, AI chat, terminal, and version control into a single workspace. Describe your app visually, then let AI turn it into code — or go the other way around.
</p>

<p align="center">
  <a href="#install">Install</a> &middot;
  <a href="#why-jamo-studio">Why Jamo</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a> &middot;
  <a href="SECURITY.md">Security</a>
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

Most dev tools force you to choose: design OR code. Visual builder OR real IDE. AI chat OR manual control.

Jamo Studio doesn't make you choose.

- **Design your app visually** on an Excalidraw canvas — wireframes, flows, architecture diagrams
- **Describe it in rich text** — brand guidelines, tech stack, user stories, all living next to your code
- **Let AI generate code from your designs** — or generate designs from your code
- **Edit with a real code editor** — syntax highlighting, vim mode, autosave
- **Chat with AI** that can see your files, your designs, and your terminal — like a collaborator who can see your screen
- **Every change is version-controlled** — auto-commits, tagged history, one-click revert

All of this runs **locally on your machine**. No cloud. No account. Your files, your git repo, your data.

## Install

### Quick install (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/jamohq/studio/main/scripts/install.sh | sh
```

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

### From source

```bash
git clone https://github.com/jamohq/studio.git
cd studio
pnpm install
pnpm dev
```

Requires: Node.js 18+, pnpm, Go 1.21+, and `protoc` (for proto codegen).

## Features

### Visual Canvas
Excalidraw-based drawing surface for wireframes, user flows, and architecture diagrams. Your designs live alongside your code and inform AI generation.

### AI Chat
Context-aware AI assistant powered by Claude. It can read your files, see your open designs, and make changes across your codebase. Every AI action is tracked as a **run** with full history.

### Project Sections
Structured rich text documents for your app's core context — purpose, tech stack, brand guidelines, user stories. These feed into AI generation so it understands *what* you're building, not just *how*.

### Code Editor
CodeMirror 6 with syntax highlighting, vim mode, and autosave. Real editor, not a toy.

### Built-in Terminal
Full terminal powered by a Go PTY backend. Run your dev server, install packages, run tests — without leaving the app.

### Source Control
Git-based version control with staging, commits, history, and one-click revert. AI actions are auto-committed with tags (`auto-code`, `auto-design`, `chat-log`) so you always know what changed and why.

### File Explorer
Create, rename, move, and delete files and folders. Drag-and-drop organization.

## How It Works

```
You describe your app          AI generates code
   (canvas + rich text)  ──►  (tracked, reversible)
         ▲                           │
         │                           ▼
   You review & iterate ◄──  Code runs in terminal
```

Every generation is a **run** — tracked, reviewable, and reversible. Don't like the output? Add a note ("use CSS Grid instead of flexbox") and re-run. Or just revert with one click.

## Architecture

Jamo Studio runs as two processes:

- **Electron + React/TypeScript frontend** (`apps/desktop/`) — the desktop UI
- **Go gRPC engine** (`engine/`) — workspace operations, terminal sessions, and file management

The Electron main process spawns the Go engine and communicates over gRPC with bearer token auth.

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
