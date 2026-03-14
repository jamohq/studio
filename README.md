# Jamo Studio

A local-first desktop studio for building with canvas, code, and terminal — all version-controlled.

## What is Jamo Studio?

Jamo Studio is an integrated desktop environment that combines visual canvas editing, code editing, and terminal access into a single workspace. Everything is backed by Git, so your work is always version-controlled. It's early-stage software under active development.

## Features

- Excalidraw-based canvas editor
- CodeMirror 6 code editor with vim mode
- Built-in terminal
- Git-based version control with sync, history, and revert
- Rich text editor (TipTap)
- File management with create, rename, and delete
- Live activity panel
- Environment validation and setup wizard

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Go 1.23+
- protoc with `protoc-gen-go` and `protoc-gen-go-grpc` plugins

### Run

```bash
pnpm install
pnpm dev
```

### Proto Codegen

```bash
bash scripts/proto-gen.sh
```

## Architecture

Jamo Studio is split into two processes:

- **Electron + React/TypeScript frontend** (`apps/desktop/`) — the desktop UI, built with React and bundled via Electron
- **Go gRPC engine** (`engine/`) — handles workspace operations, terminal sessions, and file management

The Electron main process spawns the Go engine as a child process. They communicate over gRPC with bearer token authentication. Proto definitions live in `proto/jamo/v1/`.

```
apps/desktop/       Electron app (main + renderer)
engine/             Go gRPC backend
proto/jamo/v1/      Protocol buffer definitions
scripts/            Build and codegen scripts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on setting up the project, submitting changes, and code style.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

Jamo Studio is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Commercial licenses are available for organizations that need to use Jamo Studio without the AGPL requirements. Contact [go.jhson@gmail.com](mailto:go.jhson@gmail.com) for details.
