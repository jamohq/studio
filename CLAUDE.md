# Jamo Studio

## Commit conventions
- Do not add "Co-Authored-By" lines to commit messages
- Use conventional commit format: `type(scope): description`
  - Types: feat, fix, refactor, test, docs, chore, ci, style, perf
  - Scope (optional): engine, desktop, proto, ci, scripts
  - Example: `feat(engine): add workspace listing gRPC endpoint`

## Git workflow
- Never push directly to main or dev. Always create a feature branch and PR.
- Branching strategy:
  - `main` — production releases only (merged from dev via PR)
  - `dev` — integration branch (all feature/bugfix work merges here)
  - `feat/<name>` — new features (branch from dev)
  - `bugfix/<name>` — bug fixes (branch from dev)
  - `hotfix/<name>` — urgent production fixes (branch from main, PR to both main and dev)
- Branch names use lowercase-kebab-case after the prefix

## Local test commands
- Full suite: `cd engine && go test -race -count=1 ./... && go vet ./... && cd ../apps/desktop && npx tsc --noEmit && pnpm test`
- Go only: `cd engine && go test -race -count=1 ./... && go vet ./...`
- Frontend only: `cd apps/desktop && npx tsc --noEmit && pnpm test`
