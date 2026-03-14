# Contributing to Jamo Studio

Thanks for your interest in contributing. Here's how to get involved.

## What to Work On

- **Bug fixes** — open a PR directly
- **New features** — open an issue first to discuss the approach

## Dev Setup

### Prerequisites

- Node.js 20+
- pnpm
- Go 1.23+
- protoc with `protoc-gen-go` and `protoc-gen-go-grpc` plugins

### Install and Run

```bash
pnpm install
pnpm dev
```

### Proto Codegen

If you modify any `.proto` files in `proto/jamo/v1/`, regenerate the Go bindings:

```bash
bash scripts/proto-gen.sh
```

## Project Structure

```
apps/desktop/       Electron app (main process + React renderer)
engine/             Go gRPC backend (layered architecture)
proto/jamo/v1/      Protocol buffer definitions
scripts/            Build and codegen scripts
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Keep changes focused — one concern per PR
3. Describe what the change does and why
4. Make sure the app builds and runs with `pnpm dev`

## Code Style

- Follow existing patterns in the codebase
- Go code: run `gofmt`
- Commit messages: use imperative mood ("Add feature", not "Added feature")

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE).
