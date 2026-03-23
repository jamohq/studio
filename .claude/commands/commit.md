# Commit changes

Stage, test, and commit changes with a conventional commit message.

## Input
$ARGUMENTS is an optional commit message. If empty, generate one from the diff.

## Steps

1. **Verify branch.** Run `git branch --show-current`. The current branch must NOT be `main` or `dev`. If it is, stop and tell the user to create a feature branch first with `/start`.

2. **Check for changes.** Run `git status --porcelain`. If there are no changes (staged or unstaged), stop and inform the user.

3. **Show the diff.** Run `git diff` and `git diff --cached` to understand what will be committed.

4. **Run the full test suite before committing:**
   - `cd engine && go test -race -count=1 ./... && go vet ./...`
   - `cd apps/desktop && npx tsc --noEmit && pnpm test`
   - If ANY test fails, stop immediately. Show the failure output and do NOT commit. Tell the user to fix the issues first.

5. **Stage changes.** Stage relevant files with `git add` using specific file paths. Never use `git add -A` or `git add .`. Never stage `.env`, credentials, or secret files. If there are untracked files, ask the user which ones to include.

6. **Create commit message.** If $ARGUMENTS was provided, use it (but ensure it follows conventional commit format). Otherwise, analyze the diff and generate a conventional commit message:
   - Format: `type(scope): description`
   - Types: feat, fix, refactor, test, docs, chore, ci, style, perf
   - Scope (optional): engine, desktop, proto, ci, scripts
   - Keep the first line under 72 characters
   - Add a body with details if the change is non-trivial
   - Do NOT add any Co-Authored-By lines

7. **Commit.** Run `git commit -m "<message>"` using a heredoc for multi-line messages.

8. **Confirm** the commit was created. Show the commit hash and message.
